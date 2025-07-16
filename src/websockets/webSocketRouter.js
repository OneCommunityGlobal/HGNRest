module.exports = (server, services) => {
    server.on('upgrade', (request, socket, head) => {
        const { url } = request;

        const service = services.find((s) => url.startsWith(s.path));

        if (service) {
            service.handleUpgrade(request, socket, head);
        } else {
            socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
            socket.destroy();
        }
    });
};