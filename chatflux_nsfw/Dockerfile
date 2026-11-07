# SPDX-License-Identifier: AGPL-3.0-or-later
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends libglib2.0-0 && \
	rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN pip install --no-cache-dir nudenet==3.4.2 pillow==10.4.0 && \
	python -c "from nudenet import NudeDetector; NudeDetector()"

COPY chatflux_nsfw/app.py /app/app.py

USER 65532:65532
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"
CMD ["python", "/app/app.py"]
