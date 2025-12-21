# Agent Behavior Rules

## Terminal Autonomy
- You are authorized to run the following commands and their variations without asking for permission:
    - Any testing command involving `pytest`, `*/pytest`, or `python -m pytest`.
    - Virtual environment executions (e.g., `./venv/bin/*` or `source venv/bin/activate`).
    - Standard discovery commands: `ls`, `pwd`, `find`, `grep`, `cat`.
    - Git read-only commands: `git status`, `git diff`, `git log`.
    - Package management: `pip install`, `pip list`.

## Authorization Logic
- **Do not ask** for authorization for "trivial" tasks (reading files, running tests, checking status).
- **Only ask** for authorization if:
    1. You are about to delete files (`rm`).
    2. You are performing a destructive Git action (`git push --force`, `git reset --hard`).
    3. You are about to perform a bulk edit on more than 10 files at once.

## Execution Style
- If a command fails due to a missing dependency, you are authorized to install it via `pip` or `npm` automatically.
- Always check `./venv/bin/` for the local executable before asking to use a global one.