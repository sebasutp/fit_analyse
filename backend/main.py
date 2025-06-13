import sys

from absl import flags
import os
import uvicorn
from dotenv import load_dotenv

FLAGS = flags.FLAGS

flags.DEFINE_enum(
    "log_level",
    "DEBUG",
    ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
    "Logging level.",
)


if __name__ == "__main__":
    # Parse command-line flags before accessing them.
    # This is necessary to initialize FLAGS.log_level.
    FLAGS(sys.argv)
    load_dotenv()
    # Get the log level for Uvicorn, ensuring it's lowercase as Uvicorn expects
    uvicorn_log_level = FLAGS.log_level.lower()
    uvicorn.run(
        "app.api:app_obj",
        host="0.0.0.0",
        port=int(os.getenv("PORT")),
        reload=True,
        log_level=uvicorn_log_level
    )
