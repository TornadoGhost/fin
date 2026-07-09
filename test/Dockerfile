# E2E runner: bake Playwright test deps into the image so the container
# starts instantly with no runtime `npm install` over a bind mount.
FROM mcr.microsoft.com/playwright:v1.52.0-jammy

WORKDIR /work

# Install deps first for layer caching (browsers already ship in the base image).
COPY package.json package-lock.json ./
RUN npm ci

# Test sources + config.
COPY playwright.config.ts app.e2e.ts ./

CMD ["npx", "playwright", "test", "--reporter=line"]
