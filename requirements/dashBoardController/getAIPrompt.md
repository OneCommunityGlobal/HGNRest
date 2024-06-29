Check mark: ✅
Cross Mark: ❌

# Post Badge

> ## Positive case

1. ❌ Receives a POST request in the **/api/userProfile** route
2. ✅ Returns 200 if the GPT exists and send the results back
2. ✅ Returns 200 if there is no error and new GPT Prompt is created

> ## Negative case

1. ❌ Returns 500 if GPT Prompt does not exist
2. ❌ Returns 500 if there is an error in creating the GPT Prompt

> ## Edge case