"""Assemble src/*.html into cases.html (numbered, with contents) and render Clinical_Case_Bank.pdf."""
import re, subprocess, pathlib

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

PARTS = [
    ("Part 1 · Cardiology", ["c_stemi", "c_new", "c_rf"]),
    ("Part 2 · Chest", ["r_asthma", "r_new", "r_tb"]),
    ("Part 3 · Hematology & Clinical Pathology", ["h_ida", "h_b12", "h_itp", "h_new"]),
    ("Part 4 · Tropical Medicine & Infectious Diseases", ["t_mening", "t_bruc", "t_new"]),
    ("Part 5 · Immunology & Allergy", ["i_anaph", "i_new", "i_sjs"]),
    ("Part 6 · Dermatology, Venereology & Andrology", ["d_syph", "d_scab", "d_new"]),
    ("Part 7 · Psychiatry", ["p_mdd", "p_new", "p_dts"]),
]

head = (SRC / "_head.html").read_text()
n = 0
toc, body = [], []
for part, files in PARTS:
    html = "".join((SRC / f"{f}.html").read_text() for f in files)
    titles = re.findall(r"<!--T: (.*?)-->", html)
    first = n + 1

    def number(m):
        global n
        if not m.group(1):  # question page starts a new case
            n += 1
        return f"<h2{m.group(1) or ''}>Case {n}"

    html = re.sub(r'<h2( class="ans")?>Case #', number, html)
    assert n - first + 1 == len(titles), part
    toc.append(f'<tr class="part"><td colspan="2">{part} <span class="small">({len(titles)} cases)</span></td></tr>')
    toc += [f"<tr><td>{first + i}</td><td>{t}</td></tr>" for i, t in enumerate(titles)]
    body.append(html)

cover = f"""<div class="page cover">
  <h1>Clinical Case Bank</h1>
  <p class="sub">{n} exam-style cases built from the <i>Integrated Clinical Revision Guide</i> (Ain Shams 2025–2026, Levels A–C)</p>
  <p><b>How to use:</b> each case is worth <b>10 marks</b>. Answer the case page on its own, then turn over: the next page has the model answer and the marking scheme. Doses are as printed in the source guide, so check them against your department's textbook.</p>
  <table class="toc">{''.join(toc)}</table>
</div>
"""
out = head + "<body>\n" + cover + "\n".join(body) + "\n</body>\n</html>\n"
(ROOT / "cases.html").write_text(out)

subprocess.run([CHROME, "--headless", "--no-sandbox", "--disable-gpu", "--no-pdf-header-footer",
                "--generate-pdf-document-outline", f"--print-to-pdf={ROOT / 'Clinical_Case_Bank.pdf'}",
                str(ROOT / "cases.html")], check=True, capture_output=True)
print(f"{n} cases")
