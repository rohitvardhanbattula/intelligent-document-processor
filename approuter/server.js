const approuter = require('@sap/approuter');
const ar = approuter();

ar.beforeRequestHandler.use('/get-gemini-key', (req, res, next) => {
    try {
        const vcapServices = JSON.parse(process.env.VCAP_SERVICES || '{}');
        const userProvided = vcapServices['user-provided'] || [];
        const secretService = userProvided.find(s => s.name === 'intelligent-document-secrets');
        const apiKey = secretService ? secretService.credentials.GEMINI_API_KEY : null;

        if (apiKey) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ key: apiKey }));
        } else {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: "API Key not configured in BTP" }));
        }
    } catch (e) {
        console.error("Error reading VCAP_SERVICES", e);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: "Server Error" }));
    }
});

ar.start();