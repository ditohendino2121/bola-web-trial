"""Screenshot adegan tutorial. HANYA melihat + mengisi form tanpa submit.
Tidak ada klik Daftar / Kirim / Potong / Top-Up. Kredensial via env."""
import os, time
from playwright.sync_api import sync_playwright

BASE = "https://muba-fc.vercel.app"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots")
EMAIL = os.environ.get("MUBA_EMAIL", "")
PASS = os.environ.get("MUBA_PASS", "")
assert EMAIL and PASS, "MUBA_EMAIL / MUBA_PASS belum diisi"

def shot(page, name):
    p = os.path.join(OUT, name)
    page.screenshot(path=p)
    print("saved", p)

with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=r"C:\Users\LENOVO\AppData\Local\ms-playwright\chromium-1234\chrome-win64\chrome.exe", args=["--no-sandbox"])
    pg = b.new_page(viewport={"width": 540, "height": 960}, device_scale_factor=2)
    pg.goto(BASE, wait_until="networkidle")
    pg.wait_for_timeout(2500)
    shot(pg, "01-beranda.png")

    # isi form daftar TANPA submit
    pg.get_by_placeholder("Nama lengkap").fill("Contoh Saja")
    pg.get_by_placeholder("No WA, cth 0812xxxx").fill("081200000000")
    pg.get_by_placeholder("Email").fill("contoh@saja.id")
    pg.get_by_placeholder("Password (min 6 karakter)").fill("contoh123")
    pg.wait_for_timeout(500)
    shot(pg, "02-daftar-isi.png")
    pg.reload(wait_until="networkidle")
    pg.wait_for_timeout(1500)

    # login (auth saja, tidak mengubah data)
    pg.get_by_role("button", name="Sudah punya akun").click()
    pg.get_by_placeholder("Email").fill(EMAIL)
    pg.get_by_placeholder("Password (min 6 karakter)").fill(PASS)
    pg.get_by_role("button", name="Masuk", exact=True).click()
    pg.wait_for_timeout(4000)
    shot(pg, "03-setelah-login.png")

    # topup — default paket 4x + qris
    pg.goto(BASE + "/topup", wait_until="networkidle")
    pg.wait_for_timeout(2500)
    shot(pg, "04-topup-qris.png")
    # ganti metode ke transfer (client-side saja)
    pg.locator("select").nth(1).select_option("transfer")
    pg.wait_for_timeout(800)
    shot(pg, "05-topup-transfer.png")

    # jadwal
    pg.goto(BASE + "/jadwal", wait_until="networkidle")
    pg.wait_for_timeout(2500)
    shot(pg, "06-jadwal.png")
    cards = pg.locator(".match-card")
    if cards.count() > 0:
        cards.first.scroll_into_view_if_needed()
        pg.wait_for_timeout(800)
        shot(pg, "07-jadwal-kartu.png")
    else:
        print("WARN: tidak ada match-card (belum ada jadwal upcoming?)")

    # saya / dashboard
    pg.goto(BASE + "/dashboard", wait_until="networkidle")
    pg.wait_for_timeout(2500)
    shot(pg, "08-saya.png")

    b.close()
print("DONE shots")
