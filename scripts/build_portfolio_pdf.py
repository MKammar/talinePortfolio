from pathlib import Path

from PIL import Image
from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "dist" / "assets" / "projects"
OUTPUT = ROOT / "dist" / "Taline-Chehoury-Content-Portfolio.pdf"

W, H = landscape(A4)
INK = HexColor("#090909")
PAPER = HexColor("#F5F1E9")
CREAM = HexColor("#E7E0D4")
STONE = HexColor("#C9C5BD")
OLIVE = HexColor("#85856D")
RED = HexColor("#98182B")
DEEP_RED = HexColor("#68101D")
MUTED = HexColor("#5F5B55")

# Match the website's Arial/Arial Black and Georgia direction with close embedded
# equivalents so the PDF keeps the same bold editorial character on every device.
pdfmetrics.registerFont(TTFont("Editorial", "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"))
pdfmetrics.registerFont(TTFont("EditorialBold", "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"))
pdfmetrics.registerFont(TTFont("Grotesk", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("GroteskBold", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))


def asset(name):
    return str(ASSETS / name)


def rect(c, x, y, w, h, color, stroke=None, stroke_width=0.6):
    c.setFillColor(color)
    if stroke is not None:
        c.setStrokeColor(stroke)
        c.setLineWidth(stroke_width)
        c.rect(x, y, w, h, fill=1, stroke=1)
    else:
        c.rect(x, y, w, h, fill=1, stroke=0)


def line(c, x1, y1, x2, y2, color=INK, width=0.6):
    c.setStrokeColor(color)
    c.setLineWidth(width)
    c.line(x1, y1, x2, y2)


def draw_image(c, path, x, y, w, h, bg=white, pad=0):
    """Always show the complete source image; never crop project text or artwork."""
    rect(c, x, y, w, h, bg)
    x2, y2, w2, h2 = x + pad, y + pad, w - 2 * pad, h - 2 * pad
    with Image.open(path) as im:
        iw, ih = im.size
    scale = min(w2 / iw, h2 / ih)
    dw, dh = iw * scale, ih * scale
    dx = x2 + (w2 - dw) / 2
    dy = y2 + (h2 - dh) / 2
    c.drawImage(path, dx, dy, dw, dh, preserveAspectRatio=True, mask="auto")


def draw_text(c, text, x, y, size, font="Grotesk", color=INK, leading=None, max_width=None):
    c.setFillColor(color)
    c.setFont(font, size)
    if max_width is None:
        c.drawString(x, y, text)
        return y
    words = text.split()
    lines, current = [], ""
    for word in words:
        trial = f"{current} {word}".strip()
        if not current or pdfmetrics.stringWidth(trial, font, size) <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    lead = leading or size * 1.35
    for idx, value in enumerate(lines):
        c.drawString(x, y - idx * lead, value)
    return y - len(lines) * lead


def fit_size(text, font, max_size, max_width, min_size=20):
    size = max_size
    while size > min_size and pdfmetrics.stringWidth(text, font, size) > max_width:
        size -= 1
    return size


def tracked(c, text, x, y, size=6.8, color=INK, tracking=1.2, font="GroteskBold"):
    c.saveState()
    c.setFillColor(color)
    t = c.beginText(x, y)
    t.setFont(font, size)
    t.setCharSpace(tracking)
    t.textLine(text.upper())
    c.drawText(t)
    c.restoreState()


def footer(c, page, color=INK):
    line(c, 31, 22, W - 31, 22, color, 0.45)
    tracked(c, "TALINE CHEHOURY / PORTFOLIO", 31, 9, 5.8, color, 0.65)
    c.setFillColor(color)
    c.setFont("GroteskBold", 6.5)
    c.drawRightString(W - 31, 9, f"{page:02d}")


def red_tag(c, text, x, y):
    label = text.upper()
    width = pdfmetrics.stringWidth(label, "GroteskBold", 6.5) + 20 + 0.75 * (len(label) - 1)
    rect(c, x, y, width, 20, RED)
    tracked(c, text, x + 10, y + 6, 6.5, white, 0.75)


def page_cover(c):
    left = W * 0.58
    rect(c, 0, 0, W, H, PAPER)
    rect(c, left, 0, W - left, H, STONE)
    line(c, 0, H - 48, W, H - 48, INK, 0.6)
    tracked(c, "TALINE CHEHOURY", 28, H - 30, 8.5, INK, 0.3)
    tracked(c, "PORTFOLIO", 40, H - 79, 6.3, INK, 1.4)
    red_tag(c, "Marketing / Communication / Creative Strategy", 40, 390)
    draw_text(c, "TALINE", 38, 312, 69, "GroteskBold", INK)
    draw_text(c, "CHEHOURY", 35, 239, fit_size("CHEHOURY", "GroteskBold", 69, left - 68), "GroteskBold", INK)
    draw_text(
        c,
        "I develop fashion and luxury concepts through strategy, storytelling, art direction and editorial content.",
        41,
        188,
        11.5,
        "Editorial",
        INK,
        17,
        left - 95,
    )
    line(c, 41, 126, left - 43, 126, INK, 0.65)

    # Use the page color behind contained imagery so no white picture frames appear.
    # Draw the top image last so it overlaps the middle composition like the website.
    draw_image(c, asset("hero-editorial-02.webp"), left + 54, 190, W - left - 72, 137, STONE)
    draw_image(c, asset("hero-editorial-03.webp"), left + 24, 62, 185, 100, STONE)
    draw_image(c, asset("hero-editorial-01.webp"), left + 25, 309, 165, 112, STONE)
    footer(c, 1)


def page_profile(c):
    rect(c, 0, 0, W, H, PAPER)
    tracked(c, "ABOUT / APPROACH", 32, H - 34, 7, RED, 1.5)
    draw_text(c, "STRATEGY", 30, 443, 58, "GroteskBold", INK)
    draw_text(c, "WITH AN", 30, 384, 58, "GroteskBold", INK)
    draw_text(c, "EDITORIAL EYE.", 28, 325, fit_size("EDITORIAL EYE.", "GroteskBold", 58, W - 60), "GroteskBold", RED)
    line(c, 31, 292, W - 31, 292, INK, 0.8)

    draw_text(
        c,
        "I build ideas from culture, audience and brand context - then translate them into image, copy, content and experience.",
        32,
        257,
        12,
        "EditorialBold",
        INK,
        17,
        345,
    )
    draw_text(
        c,
        "Master's student in Digital Marketing & Communication at ISCOM and Fashion Business, Marketing & Communication graduate from LISAA Mode Paris.",
        32,
        184,
        9.3,
        "Editorial",
        MUTED,
        14,
        345,
    )

    skills = [
        "Brand strategy", "Communication planning", "Art direction",
        "Editorial writing", "Social content", "Campaign development",
        "Trend research", "Photography", "Presentation design",
    ]
    panel_x = 420
    rect(c, panel_x, 43, W - panel_x - 32, 230, CREAM, INK)
    for i, skill in enumerate(skills):
        col, row = i % 3, i // 3
        x = panel_x + 20 + col * 126
        y = 230 - row * 66
        tracked(c, f"0{i + 1}", x, y + 20, 5.7, RED, 0.8)
        draw_text(c, skill.upper(), x, y, 7.2, "GroteskBold", INK, 10, 104)
    footer(c, 2)


def project_page(
    c,
    page,
    number,
    category,
    title,
    subtitle,
    description,
    role,
    images,
    bg=PAPER,
    text_color=INK,
    accent=RED,
    gallery_bg=INK,
):
    rect(c, 0, 0, W, H, bg)
    top_color = text_color
    tracked(c, f"{number:02d} / {category}", 31, H - 34, 6.8, accent, 1.3)
    tracked(c, f"{number:02d}", W - 58, H - 34, 6.8, accent, 1.0)
    title_size = fit_size(title.upper(), "GroteskBold", 49, 350)
    draw_text(c, title.upper(), 31, 446, title_size, "GroteskBold", top_color)
    tracked(c, subtitle, 33, 417, 7.2, accent, 1.0)
    draw_text(c, description, 420, 475, 9.8, "Editorial", top_color, 14, 370)
    line(c, 420, 401, W - 31, 401, accent, 1.4)
    tracked(c, "ROLE / OUTPUT", 420, 382, 6, accent, 1.0)
    draw_text(c, role, 420, 361, 7.5, "GroteskBold", top_color, 11, 365)

    gallery_y, gallery_h = 42, 285
    rect(c, 0, gallery_y - 12, W, gallery_h + 24, gallery_bg)
    gap, outer = 12, 18
    count = len(images)
    cell_w = (W - 2 * outer - (count - 1) * gap) / count
    for i, image_name in enumerate(images):
        x = outer + i * (cell_w + gap)
        draw_image(c, asset(image_name), x, gallery_y, cell_w, gallery_h, gallery_bg)
    footer(c, page, text_color)


def page_jacquemus(c):
    project_page(
        c, 3, 1, "Academic concept", "L'Apres", "Jacquemus fragrance campaign",
        "A fragrance concept built around what remains after someone leaves: warmth, memory and the quiet persistence of a familiar trace.",
        "Strategy / Storytelling / Copywriting / Art direction",
        ["jacquemus-editorial-01.webp", "jacquemus-editorial-02.webp", "jacquemus-editorial-03.webp"],
        PAPER, INK, RED, RED,
    )


def page_versace(c):
    project_page(
        c, 4, 2, "360 campaign", "Versace: The Attitude", "Brand platform and cultural campaign",
        "A communication campaign reconnecting Versace with unapologetic self-expression through manifesto, casting, influence, exhibition, budget and KPIs.",
        "Research / Strategy / Creative concept / 360 planning",
        ["versace-cover.jpg", "versace-editorial.jpg", "versace-exhibition.jpg"],
        INK, white, RED, INK,
    )


def page_bottega(c):
    project_page(
        c, 5, 3, "Communication strategy", "For Them", "Bottega Veneta luxury pet accessories",
        "An imagined quiet-luxury extension into pet accessories, expressed through editorial storytelling, product placement, digital content and retail experience.",
        "Communication strategy / Messaging / Campaign planning",
        ["bottega-visual.jpg", "bottega-product.jpg"],
        OLIVE, white, white, OLIVE,
    )


def page_chanel(c):
    project_page(
        c, 6, 4, "Beauty concept", "The Inner Spectrum", "Chanel Beauty immersive experience",
        "A personalized beauty journey translating emotion into color through neuroscience, sensory perception and immersive luxury experience design.",
        "Concept development / Research / Storytelling / Art direction",
        ["chanel-product.jpg", "chanel-cover.jpg"],
        PAPER, INK, RED, PAPER,
    )


def page_nadine(c):
    project_page(
        c, 7, 5, "Brand platform", "Nadine Ghosn", "A playful activation system",
        "A communication system connecting fine jewelry with food, conversation and culture through social content, seeding, editorial imagery and experience.",
        "Brand strategy / Creative concepts / Visual direction",
        ["nadine-cover.jpg", "nadine-moodboard.jpg", "nadine-editorial.jpg"],
        RED, white, INK, RED,
    )


def page_gastronomy(c):
    yellow = HexColor("#E8DA31")
    project_page(
        c, 8, 6, "Editorial research", "Fashion & Gastronomy", "Hospitality, collaborations and food trends",
        "An editorial publication examining how fashion brands use cafes, restaurants, collaborations and culinary trends to build culture and community.",
        "Research / Trend analysis / Editorial writing / Visual direction",
        ["gastronomy-cover.jpg", "gastronomy-hospitality.jpg", "gastronomy-matcha.jpg"],
        INK, white, yellow, INK,
    )


def page_etude(c):
    project_page(
        c, 9, 7, "Collaborative editorial", "Etude", "Fashion magazine / Denim issue",
        "A fashion magazine exploring denim as a cultural object shaped by rebellion, utility, imperfection and personal identity.",
        "Editorial writing / Art direction / Photography / Research",
        ["etude-cover.jpg", "etude-writing.jpg", "etude-editorial-alternative.jpg"],
        STONE, INK, RED, STONE,
    )


def page_contact(c):
    rect(c, 0, 0, W, H, DEEP_RED)
    c.saveState()
    c.setFillAlpha(0.14)
    c.setFillColor(INK)
    c.setFont("GroteskBold", 300)
    c.drawRightString(W + 8, -36, "TC")
    c.restoreState()
    tracked(c, "TALINE CHEHOURY", 35, H - 38, 8.5, PAPER, 1.6)
    draw_text(c, "LET'S BUILD", 33, 424, 70, "GroteskBold", white)
    draw_text(c, "SOMETHING", 31, 351, 70, "GroteskBold", PAPER)
    draw_text(c, "WORTH", 33, 278, 70, "GroteskBold", white)
    draw_text(c, "REMEMBERING.", 31, 205, fit_size("REMEMBERING.", "GroteskBold", 70, W - 62), "GroteskBold", INK)
    line(c, 36, 171, W - 36, 171, PAPER, 1.2)
    c.setFillColor(white)
    c.setFont("GroteskBold", 13)
    c.drawString(36, 137, "talinechehoury@hotmail.com")
    c.linkURL("mailto:talinechehoury@hotmail.com", (36, 130, 246, 151), relative=0)
    tracked(c, "FRENCH / ENGLISH / ARABIC", 36, 103, 7.2, PAPER, 1.3)
    draw_text(c, "Marketing / Communication / Content / Brand strategy / Events", 36, 74, 8, "Grotesk", STONE)
    footer(c, 10, PAPER)


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=(W, H), pageCompression=1)
    c.setTitle("Taline Chehoury - Marketing and Communication Portfolio")
    c.setAuthor("Taline Chehoury")
    c.setSubject("Selected fashion, luxury, editorial and communication projects")
    pages = [
        page_cover,
        page_profile,
        page_jacquemus,
        page_versace,
        page_bottega,
        page_chanel,
        page_nadine,
        page_gastronomy,
        page_etude,
        page_contact,
    ]
    for index, page in enumerate(pages):
        page(c)
        if index < len(pages) - 1:
            c.showPage()
    c.save()
    print(OUTPUT)


if __name__ == "__main__":
    build()
