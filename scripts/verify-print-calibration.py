"""Independently measure generated browser PDFs; requires pypdf, no app imports."""
import json
import pathlib
import sys
from pypdf import PdfReader

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'docs/fixtures/physical-calibration')
manifest = json.loads((root / 'manifest.json').read_text())
MM_PER_PT = 25.4 / 72


def multiply(a, b):
    return [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1],
            a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3],
            a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]]


def measured_segments(page):
    matrix = [1, 0, 0, 1, 0, 0]
    stack, segments = [], []
    point = None
    for args, op in page.get_contents().operations:
        if op == b'q':
            stack.append(matrix[:])
        elif op == b'Q':
            matrix = stack.pop()
        elif op == b'cm':
            matrix = multiply(matrix, [float(v) for v in args])
        elif op in (b'm', b'l'):
            x, y = [float(v) for v in args]
            destination = (matrix[0]*x+matrix[2]*y+matrix[4], matrix[1]*x+matrix[3]*y+matrix[5])
            if op == b'l' and point:
                segments.append(((destination[0]-point[0])*MM_PER_PT,
                                 (destination[1]-point[1])*MM_PER_PT))
            point = destination
    return segments


results = []
for item in manifest['files']:
    reader = PdfReader(root / (item['name'] + '.pdf'))
    assert len(reader.pages) == item['pages'], item['name']
    page_sizes = []
    all_segments = []
    for page in reader.pages:
        size = [float(page.mediabox.width)*MM_PER_PT, float(page.mediabox.height)*MM_PER_PT]
        # Chromium rounds page extents to device pixels; artwork coordinates
        # below must still retain their authored millimetre scale.
        assert all(abs(got-want) < 0.3 for got, want in zip(size, item['paperMm'])), size
        page_sizes.append(size)
        all_segments.extend(measured_segments(page))
    x_factor = item.get('calibrationXPercent', 100) / 100
    y_factor = item.get('calibrationYPercent', 100) / 100
    if item.get('orientation') == 'landscape':
        x_factor, y_factor = y_factor, x_factor
    expected_x = (100 if item['fixture'].startswith('xy-') else 300) * x_factor
    expected_y = (100 if item['fixture'].startswith('xy-') else 180) * y_factor
    horizontal = [abs(x) for x, y in all_segments if abs(y) < 0.001]
    vertical = [abs(y) for x, y in all_segments if abs(x) < 0.001]
    actual_x = min(horizontal, key=lambda v: abs(v-expected_x))
    actual_y = min(vertical, key=lambda v: abs(v-expected_y))
    assert abs(actual_x-expected_x) < 0.02, (item['name'], actual_x)
    assert abs(actual_y-expected_y) < 0.02, (item['name'], actual_y)
    # Stitch pitch markers are separate paths, checked in the browser gate;
    # this independently verifies their 5mm physical height in the PDF.
    assert any(abs(length-5*y_factor) < 0.02 for length in vertical)
    results.append({'file': item['name']+'.pdf', 'pages': len(reader.pages),
                    'pageMm': page_sizes, 'xPathMm': actual_x, 'yPathMm': actual_y})
report = {'status': 'passed', 'validator': 'pypdf', 'physicalPrinterChecked': False, 'results': results}
(root / 'pdf-measurements.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report, indent=2))
