FROM node:14-alpine
# Set the working directory to /app
WORKDIR /
# Copy the package.json and yarn.lock files to the container
COPY package.json .
# Install dependencies
RUN npm install
# Copy the rest of the app files to the container
COPY . .
# Build the app
RUN npm build
# Expose port 3000
EXPOSE 4500
# Set the startup command to run the app using Node.js
CMD ["node", "dist/server.js"]