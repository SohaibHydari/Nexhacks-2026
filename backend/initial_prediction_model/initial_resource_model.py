import json
import os
from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables from .env
load_dotenv()

API_KEY = os.getenv("OPENAI_API_KEY")
if not API_KEY:
    raise RuntimeError("OPENAI_API_KEY not found in .env file")

client = OpenAI(api_key=API_KEY)

SYSTEM_PROMPT = """You are an Incident Command decision-support system.

Your task is to estimate how many fire engines and ambulances
should be dispatched for an incident.

Rules:
- Output ONLY valid JSON
- Use whole numbers only
- Never return negative values
- If buildings affected = 0 AND population affected = 0 -> return 0 for all resources
- Prefer slight over-allocation to under-allocation
- Small incidents must NOT inherit large-incident responses
- Structure fires scale primarily with buildings affected
- Medical response scales primarily with population affected
- Do NOT include explanations unless explicitly requested
"""


def estimate_resources_with_gpt(
    *,
    city: str,
    incident_category: str,
    incident_subtype: str,
    buildings_affected: int,
    population_affected: int,
    temperature: float = 0.2,
) -> dict:
    """
    Uses GPT to estimate required fire engines and ambulances.

    Returns:
    {
      "firetrucks_dispatched_engines": int,
      "ambulances_dispatched": int
    }
    """

    user_prompt = f"""
Estimate required emergency resources for this incident:

City: {city}
Incident category: {incident_category}
Incident subtype: {incident_subtype}
Buildings affected: {buildings_affected}
Approximate population affected: {population_affected}

Return JSON only with this exact schema:
{{
  "firetrucks_dispatched_engines": number,
  "ambulances_dispatched": number
}}
"""

    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=temperature,
    )

    text = response.choices[0].message.content.strip()

    # Parse and return strict JSON
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Model did not return valid JSON. Got:\n{text}") from e

    # Optional: enforce integer outputs
    data["firetrucks_dispatched_engines"] = int(data.get("firetrucks_dispatched_engines", 0))
    data["ambulances_dispatched"] = int(data.get("ambulances_dispatched", 0))

    # Never negative
    data["firetrucks_dispatched_engines"] = max(0, data["firetrucks_dispatched_engines"])
    data["ambulances_dispatched"] = max(0, data["ambulances_dispatched"])

    return data


# ✅ Test runner (MUST be at top-level, not inside the function)
if __name__ == "__main__":
    result = estimate_resources_with_gpt(
        city="Austin",
        incident_category="Fire",
        incident_subtype="Structure Fire",
        buildings_affected=0,
        population_affected=0,
    )
    print(json.dumps(result, indent=2))
