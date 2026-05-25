import modal
from pydantic import BaseModel

# 1. Define the model we want to use
MODEL_NAME = "BAAI/bge-m3"

# 2. This function runs ONCE in the cloud during `modal deploy` 
# It bakes the 2.2GB model directly into your container image so it boots instantly.
def download_model():
    from sentence_transformers import SentenceTransformer
    SentenceTransformer(MODEL_NAME)

# 3. Build the Image
image = (
    modal.Image.debian_slim()
    .pip_install("fastapi", "sentence-transformers", "torch")
    .run_function(download_model) # Trigger the download during build
)

# 4. Initialize the App (Modal replaced 'Stub' with 'App')
app = modal.App("hgn-embed-service")

# 5. Define the Request Payload (Matches your Node.js backend)
class EmbedRequest(BaseModel):
    inputs: str

# 6. Create the GPU Class
@app.cls(image=image, gpu="t4", container_idle_timeout=120) 
class EmbeddingService:
    
    @modal.enter()
    def load_model(self):
        """Loads the model into GPU memory when the container starts."""
        from sentence_transformers import SentenceTransformer
        print("Loading model to GPU...")
        self.model = SentenceTransformer(MODEL_NAME).to("cuda")
        print("Model loaded successfully!")

    @modal.web_endpoint(method="POST")
    def embed(self, payload: EmbedRequest):
        """The actual API endpoint."""
        # BGE-M3 expects a list of strings
        embeddings = self.model.encode([payload.inputs], normalize_embeddings=True)
        
        # Return the flat array, exactly how your Node.js script expects it
        return embeddings.tolist()[0]