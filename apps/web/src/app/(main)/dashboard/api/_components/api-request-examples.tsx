"use client";

import { useState } from "react";

import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { ApiCatalog } from "./api-types";

export function ApiRequestExamples({ catalog, baseUrl }: { catalog: ApiCatalog; baseUrl: string }) {
  const [path, setPath] = useState("/market-data/{symbol}");
  const endpoint = catalog.endpoints.find((item) => item.path === path) ?? catalog.endpoints[0];
  if (!endpoint) return null;
  const requestPath = endpoint.path.replace("{symbol}", "BTC-USD").replace("{id}", "YOUR_ALERT_ID");
  const queries: Record<string, string> = {
    "/market-data/{symbol}": "?interval=15m",
    "/news": "?asset=BTC-USD&page=1&pageSize=20",
    "/alerts": "?page=1&pageSize=20",
    "/alerts/{id}/history": "?page=1&pageSize=20",
  };
  const query = queries[endpoint.path] ?? "";
  const url = `${baseUrl}${requestPath}${query}`;
  const examples = {
    curl: `# Bash: enter the key privately for this shell only\nread -r -s -p "API key: " MP_API_KEY; echo\ncurl --fail-with-body "${url}" \\\n  -H "Authorization: Bearer $MP_API_KEY"\nunset MP_API_KEY`,
    javascript: `// Node.js: supply MP_API_KEY through your secret manager/environment.\nconst key = process.env.MP_API_KEY;\nif (!key) throw new Error("Set MP_API_KEY securely first.");\nconst response = await fetch(${JSON.stringify(url)}, {\n  headers: { Authorization: \`Bearer \${key}\` },\n});\nconst body = await response.json();\nif (!response.ok) {\n  const retry = response.headers.get("Retry-After");\n  throw new Error(\`\${body.error?.message ?? response.status}\${retry ? \`; retry in \${retry}s\` : ""}\`);\n}\nconsole.log(body.data); // Never print the key.`,
    python: `# Python 3: standard library; credential is entered privately.\nimport getpass, json, urllib.request, urllib.error\nkey = getpass.getpass("API key: ")\nrequest = urllib.request.Request(\n    ${JSON.stringify(url)},\n    headers={"Authorization": "Bearer " + key},\n)\ntry:\n    with urllib.request.urlopen(request, timeout=30) as response:\n        print(json.load(response)["data"])\nexcept urllib.error.HTTPError as error:\n    body = json.load(error)\n    print(error.code, body.get("error", {}).get("message"))\n    if error.code == 429:\n        print("Retry after", error.headers.get("Retry-After"), "seconds")`,
  };
  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Example copied.");
    } catch {
      toast.error("Select the example to copy it manually.");
    }
  };
  return (
    <Card>
      <CardHeader className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <CardTitle>Make a request</CardTitle>
          <CardDescription>
            Requires {endpoint.scope}. Use a catalog symbol or an alert ID returned by your owned alerts.
          </CardDescription>
        </div>
        <Select value={endpoint.path} onValueChange={setPath}>
          <SelectTrigger aria-label="Example endpoint" className="w-full shrink-0 sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {catalog.endpoints.map((item) => (
                <SelectItem key={`${item.method}:${item.path}`} value={item.path}>
                  {item.title}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="min-w-0">
        <Tabs defaultValue="curl">
          <TabsList aria-label="Example language">
            <TabsTrigger value="curl">curl</TabsTrigger>
            <TabsTrigger value="javascript">JavaScript</TabsTrigger>
            <TabsTrigger value="python">Python</TabsTrigger>
          </TabsList>
          {Object.entries(examples).map(([language, code]) => (
            <TabsContent key={language} value={language} className="min-w-0">
              <div className="flex items-center justify-between gap-3 py-2">
                <p className="min-w-0 break-all text-muted-foreground text-xs">
                  {endpoint.method} {requestPath}
                  {query}
                </p>
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => void copy(code)}>
                  <Copy data-icon="inline-start" />
                  Copy
                </Button>
              </div>
              <pre className="max-w-full overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-6">
                <code>{code}</code>
              </pre>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
