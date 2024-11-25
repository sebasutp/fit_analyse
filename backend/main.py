import os

import uvicorn
from dotenv import load_dotenv

if __name__ == "__main__":
    load_dotenv()
    uvicorn.run("app.api:app_obj", host="0.0.0.0", port=int(os.getenv("PORT")), reload=True)
