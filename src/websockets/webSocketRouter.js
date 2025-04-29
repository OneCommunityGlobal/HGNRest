module.exports = (server, services) => {
    console.log("Initializing WebSocket router with services:", services.map((s) => s.path));

    server.on('upgrade', (request, socket, head) => {
        const { url } = request;

        console.log(`Incoming WebSocket upgrade request for URL: ${url}`);
        console.log(`Available services:`, services.map((s) => s.path));
        // Match the request URL to the appropriate WebSocket service
        const service = services.find((s) => url.startsWith(s.path));

        if (service) {
            console.log(`Routing WebSocket upgrade request to: ${service.path}`);
            // Route the request to the correct WebSocket service
            service.handleUpgrade(request, socket, head);
        } else {
            // If no matching service, reject the request
            socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
            socket.destroy();
        }
    });
};