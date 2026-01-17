
  # Prototype Navigation Map

  This is a code bundle for Prototype Navigation Map. The original project is available at https://www.figma.com/design/SJ0EvzNRlaQDmyiIO13Hyo/Prototype-Navigation-Map.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Incident resource prediction model

  The backend folder contains a lightweight Python model that predicts the initial number of
  firetrucks and ambulances based on historical incident data.

  Train the model:

  ```bash
  python backend/initial_resource_model.py train \
    --data backend/mock_incident_resource_usage.csv \
    --out backend/resource_model.json
  ```

  Run a prediction:

  ```bash
  python backend/initial_resource_model.py predict \
    --model backend/resource_model.json \
    --incident '{"incident_category":"Wildfire","severity_1_5":4,"city":"Sacramento","state":"CA"}'
  ```

  Evaluate model accuracy (train/test split with MAE/RMSE):

  ```bash
  python backend/evaluate_resource_model.py \
    --data backend/mock_incident_resource_usage.csv
  ```
