### How to run
First, run the Langgraph Studio:

```bash
npm run dev
```
Then, use ngrok to forward the port 2024, use by Langgraph Studio:

```bash
ngrok http 2024
```

Finally, open the following URL on your browser:
https://eu.smith.langchain.com/studio?baseUrl=<NGROK_URL>
