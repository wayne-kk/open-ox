"""
Python client example for the Open OX SDK HTTP API.

Requires: pip install httpx
"""

import json
import httpx

class OpenOxClient:
    """Thin Python client for the Open OX generation API."""

    def __init__(self, base_url: str = "http://localhost:3100", api_key: str | None = None):
        self.base_url = base_url.rstrip("/")
        self.headers = {"Content-Type": "application/json"}
        if api_key:
            self.headers["Authorization"] = f"Bearer {api_key}"

    def generate_project(
        self,
        prompt: str,
        project_id: str | None = None,
        mode: str = "web",
        style_guide: str | None = None,
        on_step=None,
    ) -> dict:
        """
        Generate a project via SSE stream.

        Args:
            prompt: Natural language project description
            project_id: Optional project ID (auto-generated if omitted)
            mode: "web" or "app"
            style_guide: Optional style guide text
            on_step: Callback for each build step event

        Returns:
            Final generation result dict
        """
        payload = {"prompt": prompt, "mode": mode}
        if project_id:
            payload["projectId"] = project_id
        if style_guide:
            payload["styleGuide"] = style_guide

        result = None
        with httpx.stream(
            "POST",
            f"{self.base_url}/generate",
            json=payload,
            headers=self.headers,
            timeout=600,
        ) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if not line.startswith("data: "):
                    continue
                event = json.loads(line[6:])
                if event.get("type") == "step" and on_step:
                    on_step(event)
                elif event.get("type") == "done":
                    result = event.get("result", event)

        return result

    def modify_project(
        self,
        project_id: str,
        instruction: str,
        on_event=None,
    ) -> None:
        """Modify an existing project via SSE stream."""
        payload = {"projectId": project_id, "instruction": instruction}

        with httpx.stream(
            "POST",
            f"{self.base_url}/modify",
            json=payload,
            headers=self.headers,
            timeout=600,
        ) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if not line.startswith("data: "):
                    continue
                event = json.loads(line[6:])
                if on_event:
                    on_event(event)

    def list_files(self, project_id: str) -> list[str]:
        """List generated files for a project."""
        resp = httpx.get(
            f"{self.base_url}/projects/{project_id}/files",
            headers=self.headers,
        )
        resp.raise_for_status()
        return resp.json().get("files", [])

    def health(self) -> dict:
        """Check server health."""
        resp = httpx.get(f"{self.base_url}/health", headers=self.headers)
        resp.raise_for_status()
        return resp.json()


# ─── Usage ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    client = OpenOxClient(
        base_url="http://localhost:3100",
        api_key=None,  # set if server requires auth
    )

    # Health check
    print("Server status:", client.health())

    # Generate a project
    def on_step(step):
        status = "✅" if step["status"] == "ok" else "❌" if step["status"] == "error" else "⏳"
        print(f"  {status} {step['step']}: {step.get('detail', '')}")

    print("\nGenerating project...")
    result = client.generate_project(
        prompt="A modern portfolio website for a photographer",
        mode="web",
        on_step=on_step,
    )

    print(f"\nSuccess: {result['success']}")
    print(f"Build: {result['verificationStatus']}")
    print(f"Files: {len(result['generatedFiles'])}")
