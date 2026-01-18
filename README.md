## Running the code

Run `npm i` to install the dependencies.

Run `npm run dev` to start the development server.

# PRISM: Priority, Resource, Incident, Simulation, and Monitoring.

## Inspiration
Emergency incidents are chaotic, time-critical, and resource-constrained. Incident Commanders are expected to make fast decisions with incomplete information, often relying on intuition and fragmented systems. This project was inspired by the question: **what if ICs had real-time visibility, historical context, and predictive support in one place?**

---

## What we Learned
We learned how to design a backend system that prioritizes **auditability and safety**, not just functionality. I gained experience with:
- Transaction-safe resource allocation
- Time-series reasoning from operational logs
- Simple but explainable ML (KNN) for decision support
- Forecasting resource depletion using rate-based models utilizing API keys 
  \[
  \text{time\_to\_threshold} = \frac{\text{available} - \text{threshold}}{\text{consumption rate}}
  \]

---

## How I Built the Project
I built the system using Django and PostgreSQL (Supabase). Resources are modeled as units with explicit status transitions, and every change is logged immutably. Historical incident data powers a K-Nearest Neighbors model to estimate resource needs, while recent status logs are used to forecast when ambulances will run critically low. The frontend polls lightweight JSON endpoints to surface warnings without automating decisions.

---

## Challenges I Faced
The hardest part was ensuring **correctness under pressure**—preventing double dispatches, handling race conditions, and making sure forecasts were explainable and trustworthy. Balancing simplicity with realism was also challenging: the system needed to be useful without pretending to replace human judgment.
