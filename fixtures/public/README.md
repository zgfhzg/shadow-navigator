# Public regional snapshots

OpenStreetMap road graphs, local place search indexes, and Overture Maps buildings for the Hong Kong Central, Tokyo Station/Marunouchi, Osaka Nakanoshima, and Kyoto Sanjo/City Hall pilot areas. These are public source data, not user locations. Source, license, collection bounds and timestamps are retained inside the JSON. Buildings retain model geometry/height, source records and original SHA256 metadata; ancillary properties are omitted for mobile transfer.

Attribution: https://www.openstreetmap.org/copyright and https://docs.overturemaps.org/attribution/ (ODbL). The snapshots are committed so the deployment can be reproduced without credentials or live data downloads. Refresh explicitly after validating new downloads with scripts/snapshot-region.mjs. Main screen search uses real names, Korean aliases and nearby connected ground paths; it does not invent missing places or routes.
