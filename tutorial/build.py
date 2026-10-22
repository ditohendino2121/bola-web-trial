"""Rakit tutorial-pemain-muba.mp4: TTS id-ID + caption + cover/outro + concat.
Output: tutorial/tutorial-pemain-muba.mp4 (1080x1920, tanpa musik)."""
import asyncio, os, re, subprocess, sys
import edge_tts
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, "shots")
OUT = os.path.join(HERE, "tutorial-pemain-muba.mp4")
FF = imageio_ffmpeg.get_ffmpeg_exe()
VOICE = "id-ID-ArdiNeural"
W, H = 1080, 1920
GOLD = (212, 175, 55)
WHITE = (255, 255, 255)
MUTED = (154, 160, 166)
BG = (14, 14, 16)

def font(bold=False, size=44):
    p = r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf"
    return ImageFont.truetype(p, size)

SEGS = [
    dict(key="cover", img=None, title="MUBA FC — Tutorial Pemain",
         caption=["4 langkah: Akun • Top-Up • Isi List • Tarik List"], vo=None, hold=3.0),
    dict(key="daftar", img="02-daftar-isi.png", title="1. Buat akun",
         caption=["Isi Nama, WA, Email, Password,", "centang akad, tekan Daftar"],
         vo="Langkah satu, buat akun. Buka web MUBA FC, pilih Daftar baru. Isi nama, nomor WA, email, dan password. Centang semua akad, lalu tekan Daftar Sekarang. Setelah itu akunmu menunggu approve admin."),
    dict(key="topup-qris", img="04-topup-qris.png", title="2. Top-Up via QRIS",
         caption=["Pilih paket, scan QRIS", "MUBA Sport Official nominal pas"],
         vo="Langkah dua, top up. Buka menu Top-Up, pilih sekali main atau paket empat kali. Bayar lewat QRIS, scan kode MUBA Sport Official dengan nominal pas."),
    dict(key="topup-transfer", img="05-topup-transfer.png", title="2. Top-Up via transfer",
         caption=["BCA Syariah 036.000.7496", "a.n Muhamad Ali Sodiqin, kirim bukti"],
         vo="Atau transfer ke BCA Syariah 036 000 7496 atas nama Muhamad Ali Sodiqin. Isi info bukti, tekan kirim konfirmasi, dan tunggu admin approve."),
    dict(key="isilist", img="06-jadwal.png", title="3. Isi list",
         caption=["Tap tanggal, pilih posisi,", "potong kredit / cash di tempat"],
         vo="Langkah tiga, isi list. Buka Jadwal Main, ketuk tanggal yang ada jadwalnya. Pilih posisimu, lalu potong satu kredit, atau bayar cash di tempat. Namamu langsung masuk list."),
    dict(key="tariklist", img="08-saya.png", title="4. Tarik list",
         caption=["Buka jadwalmu, tekan Tarik List.", "Batas H-2, lewat = wajib bayar"],
         vo="Langkah empat, tarik list. Buka lagi menu Saya, lalu jadwal yang kamu ikuti, dan tekan Tarik List. Ingat, batasnya H min dua. Lewat dari itu, kamu tetap wajib bayar."),
    dict(key="outro", img=None, title="Selesai!",
         caption=["muba-fc.vercel.app", "Kendala? Hubungi admin di menu Kontak"],
         vo="Selesai! Kalau ada kendala, hubungi admin di menu Kontak. Sampai jumpa di lapangan!"),
]

async def make_vo(text, path):
    await edge_tts.Communicate(text, VOICE).save(path)

def probe_dur(path):
    r = subprocess.run([FF, "-i", path], capture_output=True, text=True)
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    h, mnt, s = int(m.group(1)), int(m.group(2)), float(m.group(3))
    return h * 3600 + mnt * 60 + s

def draw_center(d, y, text, fnt, fill):
    bb = d.textbbox((0, 0), text, font=fnt)
    d.text(((W - (bb[2] - bb[0])) / 2, y), text, font=fnt, fill=fill)

def frame_shot(seg, idx):
    im = Image.open(os.path.join(SHOTS, seg["img"])).convert("RGB")
    if im.size != (W, H):
        im = im.resize((W, H))
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    d.rectangle([0, 0, W, 170], fill=(0, 0, 0, 200))
    draw_center(d, 30, seg["title"], font(True, 52), GOLD + (255,))
    draw_center(d, 100, f"{idx+1}/{len(SEGS)}", font(False, 34), MUTED + (255,))
    n = len(seg["caption"])
    box_top = H - 140 - n * 62
    d.rectangle([0, box_top - 20, W, H], fill=(0, 0, 0, 205))
    y = box_top
    for line in seg["caption"]:
        draw_center(d, y, line, font(False, 42), WHITE + (255,))
        y += 62
    im = Image.alpha_composite(im.convert("RGBA"), ov).convert("RGB")
    p = os.path.join(HERE, f"frame-{seg['key']}.png")
    im.save(p)
    return p

def frame_card(seg, idx, logo=True):
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    if logo:
        lg = Image.open(r"C:\Users\LENOVO\bola-web-trial\public\logo-muba.jpg").convert("RGB")
        lg = lg.resize((380, 380))
        im.paste(lg, ((W - 380) // 2, 420))
    draw_center(d, 880, seg["title"], font(True, 72), GOLD)
    y = 990
    for line in seg["caption"]:
        draw_center(d, y, line, font(False, 44), WHITE)
        y += 64
    draw_center(d, y + 20, f"{idx+1}/{len(SEGS)}", font(False, 34), MUTED)
    p = os.path.join(HERE, f"frame-{seg['key']}.png")
    im.save(p)
    return p

async def main():
    print("== TTS ==")
    for s in SEGS:
        if s["vo"]:
            mp3 = os.path.join(HERE, f"vo-{s['key']}.mp3")
            if not os.path.exists(mp3):
                await make_vo(s["vo"], mp3)
                print("vo", s["key"])
            s["dur"] = probe_dur(mp3) + 0.9
        else:
            s["dur"] = s["hold"]
    print("== frames ==")
    for i, s in enumerate(SEGS):
        fp = frame_card(s, i) if s["img"] is None else frame_shot(s, i)
        s["frame"] = fp
        print("frame", s["key"], round(s["dur"], 1), "s")
    print("== segments ==")
    lst = os.path.join(HERE, "concat.txt")
    with open(lst, "w") as f:
        for s in SEGS:
            seg = os.path.join(HERE, f"seg-{s['key']}.mp4")
            if s["vo"]:
                mp3 = os.path.join(HERE, f"vo-{s['key']}.mp3")
                cmd = [FF, "-y", "-loop", "1", "-framerate", "30", "-i", s["frame"],
                       "-i", mp3, "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
                       "-c:a", "aac", "-b:a", "128k", "-shortest", "-t", str(round(s["dur"], 2)), seg]
            else:
                cmd = [FF, "-y", "-loop", "1", "-framerate", "30", "-i", s["frame"],
                       "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
                       "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
                       "-c:a", "aac", "-b:a", "128k", "-shortest", "-t", str(round(s["dur"], 2)), seg]
            subprocess.run(cmd, check=True, capture_output=True)
            f.write(f"file '{seg}'\n")
            print("seg", s["key"])
    subprocess.run([FF, "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", OUT],
                   check=True, capture_output=True)
    total = probe_dur(OUT)
    print("DONE", OUT, round(total, 1), "s,", os.path.getsize(OUT) // 1024, "KB")

asyncio.run(main())
