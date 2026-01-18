import json
import os
import re
from dotenv import load_dotenv
from openai import OpenAI
from mistralai import Mistral
# Load environment variables from .env
load_dotenv()

# API_KEY = os.getenv("OPENAI_API_KEY")
# if not API_KEY:
#     raise RuntimeError("OPENAI_API_KEY not found in .env file")

# client = OpenAI(api_key=API_KEY)

api_key = os.getenv("MISTRAL_API_KEY")
if not api_key:
    raise RuntimeError("Mistral api key not found in .env")
model = "mistral-medium-latest"

client = Mistral(api_key=api_key)

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
    
    try:
        response = client.chat.complete(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        )
        print("RESPONSE: ", response)
        text = response.choices[0].message.content.strip()

        # Parse and return strict JSON
        cleaned = _extract_json_payload(text)
        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError as e:
            raise RuntimeError(f"Model did not return valid JSON. Got:\n{text}") from e

        # Optional: enforce integer outputs
        data["firetrucks_dispatched_engines"] = int(data.get("firetrucks_dispatched_engines", 0))
        data["ambulances_dispatched"] = int(data.get("ambulances_dispatched", 0))

        # Never negative
        data["firetrucks_dispatched_engines"] = max(0, data["firetrucks_dispatched_engines"])
        data["ambulances_dispatched"] = max(0, data["ambulances_dispatched"])
    except Exception as e:
        print("Chat completion failed, using fallback values:", e)
        data = {
            "firetrucks_dispatched_engines": 4,
            "ambulances_dispatched": 10,
        }

    return data


def _extract_json_payload(text: str) -> str:
    """Extract the first JSON object inside code fences or plain text."""

    # strip Markdown code fences like ```json
    fence_match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.S)
    if fence_match:
        return fence_match.group(1)

    # fallback: pull first {...}
    brace_match = re.search(r"(\{.*\})", text, re.S)
    if brace_match:
        return brace_match.group(1)

    return text


# Test runner (MUST be at top-level, not inside the function)
if __name__ == "__main__":
    result = estimate_resources_with_gpt(
        city="Austin",
        incident_category="Fire",
        incident_subtype="Structure Fire",
        buildings_affected=0,
        population_affected=0,
    )
    print(json.dumps(result, indent=2))
