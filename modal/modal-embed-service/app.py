# from fastapi import FastAPI, HTTPException, Header
# from pydantic import BaseModel
# from transformers import AutoModel, AutoTokenizer
# import torch

# app = FastAPI(
#     title="Embedding Service",
#     description="A small service that returns embeddings for text using a GPU-backed model.",
#     version="0.1.0",
# )

# # Change this to the model you want to serve (e.g., BAAI/bge-m3)
# MODEL_NAME = "BAAI/bge-m3"

# # Optional API key protection. Set this in the Modal environment as EMBEDDING_API_KEY.
# EXPECTED_API_KEY = None  # set in runtime via environment variable


# class EmbedRequest(BaseModel):
#     text: str


# class EmbedResponse(BaseModel):
#     embedding: list[float]


# @app.on_event("startup")
# async def load_model():
#     global tokenizer, model
#     tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
#     model = AutoModel.from_pretrained(MODEL_NAME)

#     # Prefer GPU if available (Modal T4), otherwise fallback to CPU.
#     device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
#     model.to(device)


# @app.post("/embed", response_model=EmbedResponse)
# async def embed_text(
#     request: EmbedRequest,
#     authorization: str | None = Header(None, alias="Authorization"),
# ):
#     if EXPECTED_API_KEY:
#         if not authorization or authorization.split()[1] != EXPECTED_API_KEY:
#             raise HTTPException(status_code=401, detail="Unauthorized")

#     inputs = tokenizer(
#         request.text,
#         return_tensors="pt",
#         truncation=True,
#         max_length=1024,
#     )

#     # Move inputs to the same device as the model
#     device = next(model.parameters()).device
#     inputs = {k: v.to(device) for k, v in inputs.items()}

#     with torch.no_grad():
#         outputs = model(**inputs)
#         hidden = outputs.last_hidden_state
#         embedding = hidden.mean(dim=1).squeeze().cpu().tolist()

#     return {"embedding": embedding}

import os
import modal
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from contextlib import asynccontextmanager

MODEL_REPO = "mykor/pplx-embed-v1-0.6b-GGUF"
MODEL_DIR = "/model"

# 1. Auto-Detect and Download
def download_model():
    from huggingface_hub import hf_hub_download, list_repo_files
    
    print(f"Fetching file list from {MODEL_REPO}...")
    files = list_repo_files(repo_id=MODEL_REPO)
    
    # Find all GGUF files in the repo
    gguf_files = [f for f in files if f.endswith(".gguf")]
    if not gguf_files:
        raise ValueError(f"No GGUF files found in {MODEL_REPO}")
        
    # Prefer an 8-bit quantized file, but fallback to whatever is available (like F16)
    target_file = next((f for f in gguf_files if "q8_0" in f.lower()), gguf_files[0])
    
    print(f"Found target file: {target_file}. Downloading to {MODEL_DIR}...")
    hf_hub_download(repo_id=MODEL_REPO, filename=target_file, local_dir=MODEL_DIR)
    
    # Write the detected file name to a text file so the FastAPI lifespan can read it later
    os.makedirs(MODEL_DIR, exist_ok=True)
    with open(f"{MODEL_DIR}/filename.txt", "w") as f:
        f.write(target_file)
    print("Download and caching complete!")

# 2. Build the Image
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("fastapi[standard]", "pydantic", "huggingface_hub", "llama-cpp-python")
    .run_function(download_model)
)

app = modal.App("hgn-gguf-embed-service", image=image)

# 3. Handle global state natively in FastAPI
ml_models = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    from llama_cpp import Llama
    
    # Read the text file we saved during the build phase to get the exact file name
    with open(f"{MODEL_DIR}/filename.txt", "r") as f:
        target_file = f.read().strip()
        
    print(f"Loading GGUF model: {target_file} into CPU memory...")
    ml_models["model"] = Llama(
        model_path=f"{MODEL_DIR}/{target_file}",
        embedding=True, # Enables embedding generation
        verbose=False   # Suppress noisy logs
    )
    yield
    ml_models.clear()

web_app = FastAPI(
    title="HGN Embedding Service",
    description="CPU-backed GGUF embedding service for the Agentic System.",
    lifespan=lifespan
)

class EmbedRequest(BaseModel):
    inputs: str

@web_app.post("/embed")
async def embed_text(
    request: EmbedRequest,
    authorization: str | None = Header(None, alias="Authorization"),
):
    expected_api_key = os.environ.get("EMBEDDING_API_KEY")
    if expected_api_key:
        if not authorization or len(authorization.split()) < 2 or authorization.split()[1] != expected_api_key:
            raise HTTPException(status_code=401, detail="Unauthorized")

    model = ml_models["model"]

    # Generate embedding
    response = model.create_embedding(request.inputs)
    embedding_vector = response["data"][0]["embedding"]

    return embedding_vector

# 4. Deploy to Modal's CPU tier
@app.function(
    cpu=2.0,                      
    allow_concurrent_inputs=100,  
    container_idle_timeout=15,    
    secrets=[modal.Secret.from_name("embedding-secret")]
)
@modal.asgi_app()
def serve():
    return web_app