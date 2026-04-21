# FIT file analysis

## Backend

Make sure to use Python3.10 or newer.

1. Fork/Clone

2. Create and activate a virtual environment:

    ```sh
    $ python3 -m venv venv && source venv/bin/activate
    ```

3. Install the requirements:

    ```sh
    (venv)$ pip install -r requirements.txt
    ```

4. Create a `.env` file in the root folder and add the following configuration:

    ```sh
    JWT_SECRET="some random secret key"
    JWT_ALGORITHM="HS256"
    DB_URL="sqlite:///database.db"
    TOKEN_TIMEOUT=30
    PORT=8082
    ```

5. If you use a different DB_URL, please update it also in `./backend/alembic.ini`. Then
create the database using:

    ```sh
    (venv)$ alembic upgrade head
    ```

6. Run the app:

    ```sh
    (venv)$ python main.py
    ```

6. Test at [http://localhost:8082/docs](http://localhost:8082/docs)

**Note**: the random secret `JWT_SECRET` can be generated for example 
using a command like this one:

```sh
openssl rand -hex 32
```

Feel free to change any of the configuration variables in `.env` to
match your needs.

## Cron Jobs (Power Curves)

The application includes a background scheduler to periodically recompute user power curves (all-time, 3m, 6m, 12m) to ensure accuracy.

### Configuration

Add the following to your `.env` file:

```sh
# Periods in months (default: 3, 6, 12)
POWER_CURVE_PERIODS="3,6,12"

# Frequency in hours to run the full recomputation (default: 24)
POWER_CURVE_CRON_FREQUENCY_HOURS=24
```

### Disabling the Cron Job

To disable the background cron job, you can set the frequency to a very high number or simply not rely on it (it runs in the background). Currently, the scheduler starts automatically. 
To strictly prevent it from running logic, you can set `POWER_CURVE_CRON_FREQUENCY_HOURS` to a very large value or implement a flag (not currently enforced to strictly disable start, but you can control frequency).

### Running Immediately on Startup

To force a full recomputation of power curves immediately when the backend starts, run:

```sh
(venv)$ python main.py --run_batch_startup=power_curves
```

## Front-end

Make sure to change the .env file to point to the right
backend. Then run the frontend using in development mode
using:

```
  npm install
  npm run dev
```

### Deploy Instructions

Create the dist folder using:

```
npm run build
```

Then copy the contents of the folder to the web server.
You might need to instruct your web server to try index.html
when the path does not exist physically, since this app uses
routes and some paths are handled by react. For example, in
NGINX, you could use this configuration:

```
try_files $uri $uri/ /index.html =404;
```

If you want to copy the folder as a subfolder, called for
example `/app`, you also need
to make the following two changes:
* For the static paths, edit `vite.config.js` like this:
```
export default defineConfig({
  plugins: [react()],
  base: '/app/',
})
```
* For the actual app, edit `main.jsx` like this:
```
<BrowserRouter basename="/app/">
  <App />
</BrowserRouter>
```