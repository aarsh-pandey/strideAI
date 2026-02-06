from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"status": "working"}

print("Server loaded - no imports issues!")
