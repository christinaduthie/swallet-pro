export const api = {
    async get(path) {
      const token = localStorage.getItem("token") || "fake-jwt-token-123|user@example.com";
      const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` }});
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    async post(path, body) {
      const token = localStorage.getItem("token") || "fake-jwt-token-123|user@example.com";
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body || {})
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }
  };
  