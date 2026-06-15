# Copyright (c) 2026 zouyc zouyccq@gmail.com.
# All rights reserved.
#
# Licensed under the Business Source License 1.1 (BSL 1.1).
# You may not use this file except in compliance with the License.
#
# Change Date: 2031-01-01
# On the Change Date, or the fourth anniversary of the first publicly available
# distribution of the code under the BSL, whichever comes first, the code
# automatically becomes available under the Apache License 2.0.

FROM node:22-alpine
WORKDIR /app/services/indexer
COPY services/indexer/package.json services/indexer/package-lock.json* ./
RUN npm install --omit=dev
COPY services/indexer/tsconfig.json ./
COPY services/indexer/migrations ./migrations
COPY services/indexer/src ./src
COPY services/shared ../shared
COPY deploy/testnet-v2.json ../../deploy/testnet-v2.json
EXPOSE 8800
CMD ["node", "--env-file=.env.local", "--import", "tsx", "src/index.ts"]
