# SPDX-License-Identifier: AGPL-3.0-or-later
# ChatFlux nudity detector for the Fluxer media proxy (FLUXER_NSFW_SERVICE_ENDPOINT).
#   POST /predict/image   {"base64_data": "..."}                 -> {"nsfw_probability": 0.93, "labels": [...]}
#   POST /predict/images  {"images": [{"base64_data": "..."}]}   -> {"predictions": [{"nsfw_probability": ...}]}
# The probability is the highest NudeNet score among exposed genitals, breasts and anus.

import base64
import io
import json
import logging
import os
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from nudenet import NudeDetector
from PIL import Image, ImageSequence

BLOCKED_LABELS = {
	'FEMALE_GENITALIA_EXPOSED',
	'MALE_GENITALIA_EXPOSED',
	'FEMALE_BREAST_EXPOSED',
	'ANUS_EXPOSED',
}
MAX_BODY_BYTES = 16 * 1024 * 1024
MAX_FRAMES_PER_IMAGE = 3

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger('chatflux-nsfw')
detector = NudeDetector()


def frames_of(data: bytes):
	"""First, middle and last frame of an animation, or the image itself."""
	image = Image.open(io.BytesIO(data))
	frames = [frame.convert('RGB') for frame in ImageSequence.Iterator(image)]
	if len(frames) <= MAX_FRAMES_PER_IMAGE:
		return frames
	return [frames[0], frames[len(frames) // 2], frames[-1]]


def score_frame(frame: Image.Image):
	with tempfile.NamedTemporaryFile(suffix='.jpg') as tmp:
		frame.save(tmp, format='JPEG', quality=92)
		tmp.flush()
		detections = detector.detect(tmp.name)
	hits = [d for d in detections if d.get('class') in BLOCKED_LABELS]
	score = max((float(d.get('score', 0)) for d in hits), default=0.0)
	return score, sorted({d['class'] for d in hits})


def score_image(b64: str):
	data = base64.b64decode(b64)
	best, labels = 0.0, set()
	for frame in frames_of(data):
		score, frame_labels = score_frame(frame)
		best = max(best, score)
		labels.update(frame_labels)
	return {'nsfw_probability': round(best, 4), 'labels': sorted(labels)}


class Handler(BaseHTTPRequestHandler):
	def _send(self, status: int, payload: dict):
		body = json.dumps(payload).encode()
		self.send_response(status)
		self.send_header('Content-Type', 'application/json')
		self.send_header('Content-Length', str(len(body)))
		self.end_headers()
		self.wfile.write(body)

	def do_GET(self):
		if self.path == '/health':
			self._send(200, {'ok': True})
		else:
			self._send(404, {'error': 'not found'})

	def do_POST(self):
		length = int(self.headers.get('Content-Length') or 0)
		if length <= 0 or length > MAX_BODY_BYTES:
			self._send(413, {'error': 'bad size'})
			return
		try:
			request = json.loads(self.rfile.read(length))
			if self.path == '/predict/image':
				result = score_image(request['base64_data'])
				if result['nsfw_probability'] > 0:
					log.info('image scored %s %s', result['nsfw_probability'], result['labels'])
				self._send(200, result)
			elif self.path == '/predict/images':
				predictions = [score_image(item['base64_data']) for item in request['images']]
				self._send(200, {'predictions': predictions})
			else:
				self._send(404, {'error': 'not found'})
		except Exception as error:  # noqa: BLE001 - a bad image must not kill the server
			log.warning('scan failed: %s', error)
			self._send(400, {'error': 'scan failed'})

	def log_message(self, *_args):
		pass


if __name__ == '__main__':
	port = int(os.environ.get('PORT', '8000'))
	log.info('listening on %s', port)
	ThreadingHTTPServer(('0.0.0.0', port), Handler).serve_forever()
