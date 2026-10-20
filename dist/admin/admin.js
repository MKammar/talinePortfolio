(function () {
  const config = window.PORTFOLIO_SUPABASE;
  const client = config && window.supabase
    ? window.supabase.createClient(config.url, config.publishableKey)
    : null;

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const staticImages = window.PORTFOLIO_IMAGES || [];
  const portfolioUrl = (source) => {
    if (!source || /^(?:[a-z]+:|\/\/)/i.test(source)) return source || "";
    if (source.startsWith("/")) return new URL(source, window.location.origin).href;
    return new URL(`../${source}`, window.location.href).href;
  };
  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const templates = {
    editorial: { name: "Editorial", primary: "#9d0b28", background: "#ffffff", text: "#080808", muted: "#676767", bodyFont: "Arial, Helvetica, sans-serif", headingFont: "Georgia, 'Times New Roman', serif", displayFont: "'Arial Black', Arial, Helvetica, sans-serif" },
    minimal: { name: "Minimal", primary: "#51665a", background: "#f8f8f5", text: "#1e2420", muted: "#68716b", bodyFont: "Arial, Helvetica, sans-serif", headingFont: "Arial, Helvetica, sans-serif", displayFont: "Arial, Helvetica, sans-serif" },
    rose: { name: "Soft rose", primary: "#a7445b", background: "#fff8f7", text: "#2a2021", muted: "#75696a", bodyFont: "Georgia, 'Times New Roman', serif", headingFont: "Georgia, 'Times New Roman', serif", displayFont: "Georgia, 'Times New Roman', serif" },
    noir: { name: "Noir", primary: "#d58b62", background: "#171615", text: "#f8f4ee", muted: "#b9b1a9", bodyFont: "Arial, Helvetica, sans-serif", headingFont: "Georgia, 'Times New Roman', serif", displayFont: "'Arial Black', Arial, Helvetica, sans-serif" }
  };
  let user = null;
  let content = null;
  let activePage = "overview";
  let dirty = false;
  let noticeTimer = 0;
  let draftTimer = 0;
  let revision = 0;
  let draftQueue = Promise.resolve();

  function announce(message, isError = false) {
    const notice = $("#notice");
    notice.replaceChildren(document.createTextNode(message));
    notice.classList.toggle("error", isError);
    notice.hidden = false;
    window.clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => { notice.hidden = true; }, 6000);
  }

  function setDirty(value = true) {
    dirty = value;
    if (value) revision += 1;
    const indicator = $("#save-indicator");
    indicator.classList.toggle("unsaved", dirty);
    indicator.classList.remove("saving");
    indicator.innerHTML = dirty ? "<i></i> Unsaved changes" : "<i></i> All changes saved";
    window.clearTimeout(draftTimer);
    if (dirty && user && content) {
      draftTimer = window.setTimeout(async () => {
        try {
          await queueDraftSave();
        } catch (error) {
          announce(`Could not save your draft: ${error.message || "Unexpected error."}`, true);
        }
      }, 900);
    }
  }

  function field(labelText, value, onChange, options = {}) {
    const label = make("label", options.full ? "full" : "");
    label.append(document.createTextNode(labelText));
    const input = options.multiline ? make("textarea") : make("input");
    if (!options.multiline) input.type = options.type || "text";
    if (options.multiline) input.rows = options.rows || 3;
    if (options.maxLength) input.maxLength = options.maxLength;
    input.value = value || "";
    input.addEventListener("input", () => {
      onChange(input.value);
      if (options.markDirty !== false) setDirty();
    });
    label.append(input);
    return label;
  }

  function sectionCard(title, description) {
    const card = make("section", "editor-card");
    card.append(make("h2", "", title));
    card.append(make("p", "", description));
    return card;
  }

  function defaultDesign() {
    return { template: "editorial", ...templates.editorial };
  }

  async function seedFromCurrentSite() {
    const response = await fetch("/", { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not read the existing portfolio page (${response.status}).`);
    const html = await response.text();
    const source = new DOMParser().parseFromString(html, "text/html");
    const hero = source.querySelector(".hero");
    const aboutParagraphs = Array.from(source.querySelectorAll("#about .about-grid > div:first-child p"), (p) => p.textContent.trim());
    const projects = Array.from(source.querySelectorAll("#work .project"), (article) => ({
      id: crypto.randomUUID(),
      title: article.querySelector("h3")?.textContent.trim() || "",
      category: article.querySelector(".project-number")?.textContent.trim().replace(/^\d+\s*[·.]\s*/, "") || "",
      subtitle: article.querySelector(".project-subtitle")?.textContent.trim() || "",
      description: article.querySelector(".project-copy > p")?.textContent.trim() || "",
      facts: Array.from(article.querySelectorAll(".fact"), (fact) => ({
        label: fact.querySelector("b")?.textContent.trim() || "",
        value: fact.querySelector("span")?.textContent.trim() || ""
      })),
      note: article.querySelector(".role-note")?.textContent.trim() || "",
      dark: article.classList.contains("dark"),
      images: Array.from(article.querySelectorAll(".gallery img"), (image) => ({
        src: image.getAttribute("src") || "",
        alt: image.alt || "",
        contain: image.closest("figure")?.classList.contains("contain") || false
      }))
    }));
    const email = source.querySelector('footer a[href^="mailto:"]');
    return {
      identity: {
        brand: source.querySelector("header .logo")?.textContent.trim() || "Taline Chehoury",
        seoTitle: source.title || "",
        seoDescription: source.querySelector('meta[name="description"]')?.content || ""
      },
      hero: {
        eyebrow: hero?.querySelector(".eyebrow")?.textContent.trim() || "",
        title: Array.from(hero?.querySelectorAll("h1 span") || [], (line) => line.textContent.trim()).join(" ")
          || hero?.querySelector("h1")?.textContent.trim()
          || "",
        intro: hero?.querySelector(".intro")?.textContent.trim() || "",
        images: Array.from(hero?.querySelectorAll(".hero-collage img") || [], (image) => image.getAttribute("src") || "")
      },
      work: {
        title: source.querySelector("#work .section-head h2")?.textContent.trim() || "Selected work",
        intro: source.querySelector("#work .section-head p")?.textContent.trim() || ""
      },
      about: {
        title: source.querySelector("#about .section-head h2")?.textContent.trim() || "About",
        intro: source.querySelector("#about .section-head p")?.textContent.trim() || "",
        paragraphs: aboutParagraphs,
        skills: Array.from(source.querySelectorAll("#about .skills > div"), (item) => item.textContent.trim()),
        note: source.querySelector("#about .note")?.textContent.trim() || ""
      },
      contact: {
        heading: source.querySelector("footer h2")?.textContent.trim() || "",
        email: email?.textContent.trim() || "",
        languages: source.querySelector("footer .eyebrow")?.textContent.trim() || ""
      },
      sections: { work: true, about: true, contact: true },
      design: defaultDesign(),
      projects
    };
  }

  async function loadPortfolio() {
    const { data: draft, error: draftError } = await client
      .from("portfolio_drafts").select("content, updated_at").eq("id", true).maybeSingle();
    if (draftError) throw draftError;
    if (draft) {
      content = draft.content;
      return;
    }
    const { data: published, error: publishedError } = await client
      .from("portfolio_site").select("content").eq("id", true).maybeSingle();
    if (publishedError) throw publishedError;
    content = published?.content || await seedFromCurrentSite();
  }

  async function authorize(sessionUser) {
    user = sessionUser;
    const { data, error } = await client.rpc("is_portfolio_admin");
    if (error) throw error;
    if (data !== true) {
      await client.auth.signOut();
      throw new Error("This account is signed in but is not on the portfolio admin list. Add it in Supabase using the setup guide.");
    }
    await loadPortfolio();
    $("#account-email").textContent = user.email || "Portfolio admin";
    $("#login-screen").hidden = true;
    $("#app").hidden = false;
    $("#project-count").textContent = String(content.projects.length);
    setDirty(false);
    renderPage();
  }

  function renderOverview() {
    const root = $("#page-content");
    const welcome = make("section", "welcome");
    const welcomeCopy = make("div");
    welcomeCopy.append(make("p", "eyebrow", "YOUR PORTFOLIO, YOUR WAY"));
    welcomeCopy.append(make("h2", "", "A little space to make it yours."));
    welcomeCopy.append(make("p", "", "Update your story, arrange projects, and publish when you're ready."));
    welcome.append(welcomeCopy);
    const editButton = make("button", "button quiet", "Edit site content →");
    editButton.addEventListener("click", () => showPage("content"));
    welcome.append(editButton);

    const stats = make("div", "stats");
    [
      ["Projects", content.projects.length],
      ["Sections", Object.values(content.sections || {}).filter(Boolean).length],
      ["Design", templates[content.design?.template]?.name || "Custom"]
    ].forEach(([label, value]) => {
      const card = make("div", "stat-card");
      card.append(make("span", "", label), make("strong", "", String(value)));
      stats.append(card);
    });

    const grid = make("div", "dashboard-grid");
    const quick = make("section", "panel");
    const quickHead = make("div", "panel-head");
    quickHead.append(make("h2", "", "Quick actions"));
    quick.append(quickHead);
    const actions = make("div", "quick-actions");
    [
      ["✎", "Edit your story", "Change your intro and contact details", "content"],
      ["＋", "Add a project", "Showcase something new", "add-project"],
      ["◈", "Try a new look", "Choose a design template", "design"],
      ["↑", "Publish updates", "Make your latest edits live", "publish"]
    ].forEach(([icon, title, subtitle, action]) => {
      const button = make("button", "quick-action");
      const iconNode = make("span", "action-icon", icon);
      const copy = make("span");
      copy.append(make("strong", "", title), make("small", "", subtitle));
      button.append(iconNode, copy);
      button.addEventListener("click", () => {
        if (action === "add-project") openProjectDialog();
        else if (action === "publish") publishContent();
        else showPage(action);
      });
      actions.append(button);
    });
    quick.append(actions);

    const recent = make("section", "panel");
    const recentHead = make("div", "panel-head");
    recentHead.append(make("h2", "", "Your projects"));
    const all = make("button", "button quiet small", "Manage");
    all.addEventListener("click", () => showPage("projects"));
    recentHead.append(all);
    recent.append(recentHead);
    const list = make("div", "project-mini-list");
    content.projects.slice(0, 4).forEach((project) => {
      const item = make("div", "project-mini");
      const image = make("img");
      image.src = portfolioUrl(project.images?.[0]?.src);
      image.alt = "";
      const copy = make("div");
      copy.append(make("strong", "", project.title), make("span", "", project.subtitle));
      item.append(image, copy, make("span", "status-pill", "Portfolio"));
      list.append(item);
    });
    if (!content.projects.length) list.append(make("p", "muted", "Add your first project to get started."));
    recent.append(list);
    grid.append(quick, recent);
    root.replaceChildren(welcome, stats, grid);
  }

  function renderContentEditor() {
    const root = $("#page-content");
    const intro = make("p", "page-intro", "Edit the words visitors see. Your changes are saved as a draft until you publish.");
    const grid = make("div", "editor-grid");

    const identityCard = sectionCard("Portfolio identity", "Set your site name and the title visitors see in search results.");
    const identityFields = make("div", "field-grid");
    identityFields.append(
      field("Header name", content.identity.brand, (value) => { content.identity.brand = value; }),
      field("Browser / search title", content.identity.seoTitle, (value) => { content.identity.seoTitle = value; }),
      field("Search description", content.identity.seoDescription, (value) => { content.identity.seoDescription = value; }, { full: true, multiline: true, rows: 2 })
    );
    identityCard.append(identityFields);

    const heroCard = sectionCard("First impression", "Your opening section is the first thing visitors read.");
    const heroFields = make("div", "field-grid");
    heroFields.append(
      field("Small heading", content.hero.eyebrow, (value) => { content.hero.eyebrow = value; }),
      field("Main title", content.hero.title, (value) => { content.hero.title = value; }),
      field("Introduction", content.hero.intro, (value) => { content.hero.intro = value; }, { full: true, multiline: true, rows: 3 }),
      field("Hero image URLs (one per line)", (content.hero.images || []).join("\n"), (value) => {
        content.hero.images = value.split("\n").map((line) => line.trim()).filter(Boolean);
      }, { full: true, multiline: true, rows: 3 })
    );
    heroCard.append(heroFields);

    const workCard = sectionCard("Selected work heading", "Introduce the projects visitors can browse.");
    const workFields = make("div", "field-grid");
    workFields.append(
      field("Section title", content.work.title, (value) => { content.work.title = value; }),
      field("Introduction", content.work.intro, (value) => { content.work.intro = value; }, { multiline: true, rows: 3 })
    );
    workCard.append(workFields);

    const aboutCard = sectionCard("About section", "Tell visitors about your background and approach.");
    const aboutFields = make("div", "field-grid");
    aboutFields.append(
      field("Section title", content.about.title, (value) => { content.about.title = value; }),
      field("Short introduction", content.about.intro, (value) => { content.about.intro = value; }, { multiline: true, rows: 3 }),
      field("Paragraphs (one paragraph per line)", (content.about.paragraphs || []).join("\n\n"), (value) => {
        content.about.paragraphs = value.split(/\n\s*\n/).map((line) => line.trim()).filter(Boolean);
      }, { full: true, multiline: true, rows: 6 }),
      field("Skills (one per line)", (content.about.skills || []).join("\n"), (value) => {
        content.about.skills = value.split("\n").map((line) => line.trim()).filter(Boolean);
      }, { full: true, multiline: true, rows: 5 }),
      field("Portfolio note", content.about.note, (value) => { content.about.note = value; }, { full: true, multiline: true, rows: 2 })
    );
    aboutCard.append(aboutFields);

    const contactCard = sectionCard("Contact details", "Help a future collaborator get in touch.");
    const contactFields = make("div", "field-grid");
    contactFields.append(
      field("Closing headline", content.contact.heading, (value) => { content.contact.heading = value; }, { full: true, multiline: true, rows: 2 }),
      field("Email address", content.contact.email, (value) => { content.contact.email = value; }, { type: "email" }),
      field("Languages / short note", content.contact.languages, (value) => { content.contact.languages = value; })
    );
    contactCard.append(contactFields);

    const visibility = sectionCard("What visitors can see", "Hide a section without deleting its content.");
    const checks = make("div", "check-list");
    [["work", "Selected work"], ["about", "About"], ["contact", "Contact"]].forEach(([key, label]) => {
      const row = make("label", "check-row");
      const checkbox = make("input");
      checkbox.type = "checkbox";
      checkbox.checked = content.sections[key] !== false;
      checkbox.addEventListener("change", () => { content.sections[key] = checkbox.checked; setDirty(); });
      row.append(checkbox, document.createTextNode(label));
      checks.append(row);
    });
    visibility.append(checks);

    grid.append(identityCard, heroCard, workCard, aboutCard, contactCard, visibility);
    root.replaceChildren(intro, grid);
  }

  function renderProjects() {
    const root = $("#page-content");
    const toolbar = make("div", "page-toolbar");
    const heading = make("div");
    heading.append(make("h2", "", "Your selected work"), make("p", "", "Drag the handle to change the order visitors see."));
    const add = make("button", "button primary", "＋ Add project");
    add.addEventListener("click", () => openProjectDialog());
    toolbar.append(heading, add);
    const list = make("div", "project-list");
    content.projects.forEach((project, index) => {
      const row = make("article", "project-row");
      row.draggable = true;
      row.dataset.index = String(index);
      const handle = make("span", "drag-handle", "⠿");
      handle.setAttribute("aria-label", "Drag to reorder");
      const image = make("img");
      image.src = portfolioUrl(project.images?.[0]?.src);
      image.alt = "";
      const copy = make("div", "project-row-main");
      copy.append(make("strong", "", project.title || "Untitled project"), make("span", "", project.subtitle || project.category));
      const actions = make("div", "project-row-actions");
      const edit = make("button", "", "Edit");
      edit.type = "button";
      edit.addEventListener("click", () => openProjectDialog(project));
      const remove = make("button", "", "Delete");
      remove.type = "button";
      remove.addEventListener("click", () => {
        if (!window.confirm(`Delete “${project.title || "this project"}” from the draft?`)) return;
        content.projects.splice(index, 1);
        setDirty();
        renderProjects();
      });
      actions.append(edit, remove);
      row.append(handle, image, copy, actions);
      row.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/plain", String(index));
        event.dataTransfer.effectAllowed = "move";
        row.classList.add("dragging");
      });
      row.addEventListener("dragend", () => row.classList.remove("dragging"));
      row.addEventListener("dragover", (event) => event.preventDefault());
      row.addEventListener("drop", (event) => {
        event.preventDefault();
        const from = Number(event.dataTransfer.getData("text/plain"));
        const to = Number(row.dataset.index);
        if (!Number.isInteger(from) || from === to) return;
        const [moved] = content.projects.splice(from, 1);
        content.projects.splice(to, 0, moved);
        setDirty();
        renderProjects();
      });
      list.append(row);
    });
    if (!content.projects.length) list.append(make("div", "empty-state", "No projects yet. Add one to start building your portfolio."));
    root.replaceChildren(toolbar, list);
    $("#project-count").textContent = String(content.projects.length);
  }

  function renderDesign() {
    const root = $("#page-content");
    root.append(make("p", "page-intro", "Choose a ready-made direction, then fine-tune the colors. Click a look or drag it onto the preview. Your content stays in place."));
    const card = sectionCard("Start with a design example", "Drag a visual direction onto the preview, or click to apply it.");
    const grid = make("div", "template-grid");
    const artColors = {
      editorial: ["#fff", "#161413", "#9d0b28"],
      minimal: ["#f8f8f5", "#1e2420", "#51665a"],
      rose: ["#fff8f7", "#2a2021", "#a7445b"],
      noir: ["#171615", "#f8f4ee", "#d58b62"]
    };
    Object.entries(templates).forEach(([key, template]) => {
      const button = make("button", `template-card${content.design.template === key ? " selected" : ""}`);
      button.type = "button";
      button.draggable = true;
      const art = make("div", "template-art");
      art.style.background = artColors[key][0];
      art.style.color = artColors[key][1];
      const accent = make("span");
      accent.style.background = artColors[key][2];
      art.append(make("span"), make("span"), make("span"), accent);
      button.append(art, make("strong", "", template.name), make("small", "", key === "editorial" ? "Bold type · deep red" : key === "minimal" ? "Calm · modern · natural" : key === "rose" ? "Warm · soft · romantic" : "Dark · dramatic · copper"));
      button.addEventListener("click", () => selectTemplate(key));
      button.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/portfolio-template", key);
        event.dataTransfer.effectAllowed = "copy";
      });
      grid.append(button);
    });
    card.append(grid);

    const customize = sectionCard("Make it yours", "Pick any color to fine-tune your selected example.");
    const controls = make("div", "theme-controls");
    [["primary", "Accent color"], ["background", "Page background"], ["text", "Main text"], ["muted", "Secondary text"]].forEach(([key, label]) => {
      const wrapper = make("label", "color-control");
      const input = make("input");
      input.type = "color";
      input.value = /^#[0-9a-f]{6}$/i.test(content.design[key] || "") ? content.design[key] : templates.editorial[key];
      input.addEventListener("input", () => {
        content.design[key] = input.value;
        content.design.template = "custom";
        setDirty();
        updateDesignPreview(preview);
      });
      wrapper.append(input, make("span", "", label));
      controls.append(wrapper);
    });
    customize.append(controls);
    const preview = make("div", "design-preview");
    updateDesignPreview(preview);
    preview.addEventListener("dragover", (event) => {
      if (event.dataTransfer.types.includes("text/portfolio-template")) {
        event.preventDefault();
        preview.classList.add("drop-target");
      }
    });
    preview.addEventListener("dragleave", () => preview.classList.remove("drop-target"));
    preview.addEventListener("drop", (event) => {
      event.preventDefault();
      const key = event.dataTransfer.getData("text/portfolio-template");
      if (templates[key]) selectTemplate(key);
    });
    customize.append(preview);

    const sectionCardNode = sectionCard("Section visibility", "Choose which parts of the portfolio appear on the public site.");
    const checks = make("div", "check-list");
    [["work", "Selected work"], ["about", "About"], ["contact", "Contact"]].forEach(([key, label]) => {
      const row = make("label", "check-row");
      const input = make("input");
      input.type = "checkbox";
      input.checked = content.sections[key] !== false;
      input.addEventListener("change", () => { content.sections[key] = input.checked; setDirty(); });
      row.append(input, document.createTextNode(label));
      checks.append(row);
    });
    sectionCardNode.append(checks);
    root.append(card, customize, sectionCardNode);
  }

  function selectTemplate(key) {
    content.design = { template: key, ...templates[key] };
    setDirty();
    renderDesign();
  }

  function updateDesignPreview(preview) {
    const design = content.design || {};
    preview.style.setProperty("--preview-bg", design.background || "#fff");
    preview.style.setProperty("--preview-ink", design.text || "#080808");
    preview.style.setProperty("--preview-primary", design.primary || "#9d0b28");
    preview.style.setProperty("--preview-muted", design.muted || "#676767");
    preview.replaceChildren(make("span", "", "MARKETING · COMMUNICATION · CREATIVE STRATEGY"));
    preview.append(make("strong", "", content.hero.title || "Your portfolio title"));
    preview.append(make("p", "", content.hero.intro || "Your introduction will appear here."));
  }

  async function uploadImage(file) {
    if (!file || !user) throw new Error("Choose an image file while signed in.");
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      throw new Error("Choose a JPG, PNG, WebP, or GIF image.");
    }
    if (file.size > 10 * 1024 * 1024) throw new Error("Images must be 10 MB or smaller.");
    const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
    const path = `${user.id}/${Date.now()}-${safeName || "image"}`;
    const { error } = await client.storage.from("portfolio-media").upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    const { data } = client.storage.from("portfolio-media").getPublicUrl(path);
    return data.publicUrl;
  }

  async function renderMedia() {
    const root = $("#page-content");
    const toolbar = make("div", "media-top");
    const copy = make("div");
    copy.append(make("h2", "", "Image library"), make("p", "", "Upload a new image, then copy its URL into a project."));
    const uploadLabel = make("label", "button primary");
    uploadLabel.append(document.createTextNode("＋ Upload image"));
    const picker = make("input");
    picker.type = "file";
    picker.accept = "image/jpeg,image/png,image/webp,image/gif";
    picker.hidden = true;
    picker.addEventListener("change", async () => {
      try {
        if (!picker.files?.[0]) return;
        setBusy(true);
        const url = await uploadImage(picker.files[0]);
        announce("Image uploaded. Open a project and paste its URL to add it.");
        await renderMedia();
      } catch (error) {
        announce(error.message || "Image upload failed.", true);
      } finally {
        setBusy(false);
        picker.value = "";
      }
    });
    uploadLabel.append(picker);
    toolbar.append(copy, uploadLabel);

    const media = new Map();
    staticImages.forEach((path) => {
      const name = path.split("/").pop().replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
      media.set(portfolioUrl(path), name);
    });
    content.projects.forEach((project) => (project.images || []).forEach((image) => {
      if (image.src) media.set(portfolioUrl(image.src), image.alt || project.title || "Portfolio image");
    }));
    try {
      const { data: stored, error } = await client.storage.from("portfolio-media").list(user.id, {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" }
      });
      if (error) throw error;
      (stored || []).filter((file) => file.name).forEach((file) => {
        const path = `${user.id}/${file.name}`;
        const { data } = client.storage.from("portfolio-media").getPublicUrl(path);
        media.set(data.publicUrl, file.name);
      });
    } catch (error) {
      announce(`Could not load your image library: ${error.message || "Unexpected error."}`, true);
    }
    const grid = make("div", "media-grid");
    media.forEach((alt, url) => {
      const card = make("article", "media-card");
      card.dataset.url = url;
      const image = make("img");
      image.src = url;
      image.alt = alt;
      image.loading = "lazy";
      image.addEventListener("error", () => { image.hidden = true; });
      const caption = make("span", "", alt);
      const copyUrl = make("button", "media-copy", "Copy image URL");
      copyUrl.type = "button";
      copyUrl.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(url);
          announce("Image URL copied. Add an image row in a project, then paste the URL.");
        } catch (error) {
          announce(`Could not copy the image URL: ${error.message || "Clipboard access is unavailable."}`, true);
        }
      });
      card.append(image, caption, copyUrl);
      grid.append(card);
    });
    if (!media.size) grid.append(make("div", "empty-state", "Images from your projects will appear here after you add them."));
    root.replaceChildren(toolbar, grid);
  }

  function renderSettings() {
    const root = $("#page-content");
    root.append(make("p", "page-intro", "Your private editor is connected to Supabase. Only accounts explicitly added as portfolio admins can change or publish content."));
    const card = sectionCard("Site and account", "A few useful shortcuts for managing your portfolio.");
    [
      ["Admin account", user?.email || "Signed in"],
      ["Cloud drafts", "Saved securely in your Supabase project"],
      ["Public media", "Images are served from the portfolio-media storage bucket"]
    ].forEach(([title, description]) => {
      const row = make("div", "setting-row");
      const detail = make("div");
      detail.append(make("strong", "", title), make("p", "", description));
      row.append(detail, make("span", "status-pill", "Connected"));
      card.append(row);
    });
    const help = sectionCard("First-time setup", "Publishing requires one secure GitHub Edge Function setup.");
    const steps = make("ol", "setup-steps");
    [
      "Run supabase/schema.sql in the Supabase SQL Editor.",
      "Create your admin login under Authentication → Users.",
      "Add that user's UUID to public.portfolio_admins (the setup steps are in README.md).",
      "Deploy supabase/functions/publish-portfolio with the Supabase CLI and add the GitHub token, repository, production branch, and site URL to Supabase Edge Function secrets.",
      "Sign in here, edit your portfolio, then select Publish changes to create a GitHub commit and trigger Vercel."
    ].forEach((step) => steps.append(make("li", "", step)));
    help.append(steps);
    root.append(card, help);
  }

  function renderPage() {
    const titles = { overview: "Overview", content: "Site content", projects: "Projects", design: "Design studio", media: "Image library", settings: "Settings" };
    $("#page-title").textContent = titles[activePage];
    $("#main-nav").querySelectorAll("[data-page]").forEach((button) => button.classList.toggle("active", button.dataset.page === activePage));
    const root = $("#page-content");
    root.replaceChildren();
    if (!content) return;
    if (activePage === "overview") renderOverview();
    if (activePage === "content") renderContentEditor();
    if (activePage === "projects") renderProjects();
    if (activePage === "design") renderDesign();
    if (activePage === "media") renderMedia();
    if (activePage === "settings") renderSettings();
  }

  function showPage(page) {
    activePage = page;
    renderPage();
  }

  function setBusy(busy) {
    $("#publish-button").disabled = busy;
    $("#publish-button").textContent = busy ? "Saving…" : "Publish changes ↑";
    $("#save-indicator").classList.toggle("saving", busy);
  }

  async function saveDraft() {
    const savedRevision = revision;
    const snapshot = JSON.parse(JSON.stringify(content));
    const { error } = await client.from("portfolio_drafts").upsert({
      id: true,
      content: snapshot,
      updated_at: new Date().toISOString()
    }, { onConflict: "id" });
    if (error) throw error;
    if (revision === savedRevision) setDirty(false);
  }

  function queueDraftSave() {
    const operation = draftQueue.then(saveDraft);
    draftQueue = operation.catch(() => {});
    return operation;
  }

  async function publishContent() {
    if (!content || !user) return;
    setBusy(true);
    try {
      window.clearTimeout(draftTimer);
      await queueDraftSave();
      const { error: livePublishError } = await client.from("portfolio_site").upsert({
        id: true,
        content: JSON.parse(JSON.stringify(content)),
        published_at: new Date().toISOString()
      }, { onConflict: "id" });
      if (livePublishError) throw livePublishError;

      let data;
      let githubError;
      try {
        const result = await client.functions.invoke("publish-portfolio", {
          body: { content: JSON.parse(JSON.stringify(content)) }
        });
        data = result.data;
        githubError = result.error;
      } catch (error) {
        githubError = error;
      }

      if (githubError) {
        let detail = githubError.message || "The GitHub publisher could not be reached.";
        if (githubError.context instanceof Response) {
          const responseBody = await githubError.context.json().catch(() => null);
          if (responseBody?.error) detail = responseBody.error;
          else if (githubError.context.status === 404) detail = "The GitHub publisher function is not deployed in Supabase yet.";
        }
        setDirty(false);
        announce(`Your live site is updated from Supabase, but no GitHub commit was created. ${detail} Deploy the function and add its secrets as described in README.md.`, true);
        return;
      }
      if (data?.error) {
        setDirty(false);
        announce(`Your live site is updated from Supabase, but no GitHub commit was created. ${data.error}`, true);
        return;
      }

      setDirty(false);
      announce("Committed to GitHub. Vercel will update your live site when its deployment finishes.");
      if (data?.commitUrl) {
        const link = make("a", "", " View commit");
        link.href = data.commitUrl;
        link.target = "_blank";
        link.rel = "noreferrer";
        $("#notice").append(link);
      }
    } catch (error) {
      announce(`Could not publish your changes to the live site: ${error.message || "Unexpected error."} Your draft is still saved.`, true);
    } finally {
      setBusy(false);
    }
  }

  function addImageRow(image = {}) {
    const list = $("#project-images");
    if (list.children.length >= 6) {
      announce("A project can have up to six images.", true);
      return;
    }
    const row = make("div", "image-row");
    const fields = make("div", "field-grid");
    const urlField = field("Image URL", image.src || "", () => {}, { full: true, markDirty: false });
    const altField = field("Image description (alt text)", image.alt || "", () => {}, { markDirty: false });
    const urlInput = $("input", urlField);
    const altInput = $("input", altField);
    urlInput.addEventListener("input", () => {
      preview.src = portfolioUrl(urlInput.value.trim());
      preview.hidden = !urlInput.value.trim();
    });
    const assetLabel = make("label", "");
    assetLabel.append(document.createTextNode("Choose an image from your portfolio"));
    const assetPicker = make("select");
    const placeholder = make("option", "", "Choose an image…");
    placeholder.value = "";
    assetPicker.append(placeholder);
    staticImages.forEach((path) => {
      const option = make("option", "", path.split("/").pop());
      option.value = path;
      assetPicker.append(option);
    });
    assetPicker.addEventListener("change", () => {
      if (!assetPicker.value) return;
      urlInput.value = assetPicker.value;
      if (!altInput.value) altInput.value = assetPicker.value.split("/").pop().replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
      preview.src = portfolioUrl(assetPicker.value);
      preview.hidden = false;
    });
    assetLabel.append(assetPicker);
    const containLabel = make("label", "check-row");
    const contain = make("input");
    contain.type = "checkbox";
    contain.checked = Boolean(image.contain);
    containLabel.append(contain, document.createTextNode("Fit whole image"));
    fields.append(urlField, assetLabel, altField, containLabel);

    const actions = make("div", "image-row-actions");
    const preview = make("img", "image-row-preview");
    preview.alt = image.alt || "";
    preview.src = portfolioUrl(image.src);
    preview.hidden = !image.src;
    const uploadButton = make("button", "", "Upload");
    uploadButton.type = "button";
    const file = make("input");
    file.type = "file";
    file.accept = "image/jpeg,image/png,image/webp,image/gif";
    file.addEventListener("change", async () => {
      try {
        if (!file.files?.[0]) return;
        uploadButton.disabled = true;
        uploadButton.textContent = "Uploading…";
        const url = await uploadImage(file.files[0]);
        urlInput.value = url;
        preview.src = url;
        preview.hidden = false;
      } catch (error) {
        announce(error.message || "Image upload failed.", true);
      } finally {
        uploadButton.disabled = false;
        uploadButton.textContent = "Upload";
        file.value = "";
      }
    });
    uploadButton.addEventListener("click", () => file.click());
    const remove = make("button", "", "Remove");
    remove.type = "button";
    remove.addEventListener("click", () => row.remove());
    actions.append(uploadButton, remove, file);
    row.append(preview, fields, actions);
    list.append(row);
  }

  function openProjectDialog(project) {
    const dialog = $("#project-dialog");
    const form = $("#project-form");
    form.reset();
    $("#project-images").replaceChildren();
    $("#dialog-title").textContent = project ? "Edit project" : "Add a project";
    $("#project-id").value = project?.id || crypto.randomUUID();
    $("#project-title").value = project?.title || "";
    $("#project-category").value = project?.category || "";
    $("#project-subtitle").value = project?.subtitle || "";
    $("#project-description").value = project?.description || "";
    $("#fact-role").value = project?.facts?.[0]?.value || "";
    $("#fact-deliverables").value = project?.facts?.[1]?.value || "";
    $("#fact-skills").value = project?.facts?.[2]?.value || "";
    $("#project-note").value = project?.note || "";
    $("#project-dark").checked = Boolean(project?.dark);
    (project?.images || []).forEach(addImageRow);
    if (!project?.images?.length) addImageRow();
    dialog.showModal();
  }

  function saveProject(event) {
    event.preventDefault();
    const fields = Array.from($("#project-images").querySelectorAll(".image-row"));
    const images = fields.map((row) => ({
      src: $("input:not([type=checkbox])", row.querySelector(".field-grid label:first-child"))?.value.trim() || "",
      alt: $("input:not([type=checkbox])", row.querySelector(".field-grid label:nth-child(3)"))?.value.trim() || "",
      contain: $("input[type=checkbox]", row)?.checked || false
    })).filter((image) => image.src);
    const project = {
      id: $("#project-id").value,
      title: $("#project-title").value.trim(),
      category: $("#project-category").value.trim(),
      subtitle: $("#project-subtitle").value.trim(),
      description: $("#project-description").value.trim(),
      facts: [
        { label: "My role", value: $("#fact-role").value.trim() },
        { label: "Deliverables", value: $("#fact-deliverables").value.trim() },
        { label: "Skills shown", value: $("#fact-skills").value.trim() }
      ],
      note: $("#project-note").value.trim(),
      dark: $("#project-dark").checked,
      images
    };
    const oldIndex = content.projects.findIndex((item) => item.id === project.id);
    if (oldIndex >= 0) content.projects[oldIndex] = project;
    else content.projects.push(project);
    $("#project-dialog").close();
    setDirty();
    renderProjects();
    $("#project-count").textContent = String(content.projects.length);
    if (activePage === "overview") renderPage();
  }

  $("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorLabel = $("#login-error");
    errorLabel.hidden = true;
    if (!client) {
      errorLabel.textContent = "Supabase configuration could not load. Check the public project URL and publishable key.";
      errorLabel.hidden = false;
      return;
    }
    const button = $("#login-form button[type=submit]");
    button.disabled = true;
    button.textContent = "Signing in…";
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: $("#login-email").value.trim(),
        password: $("#login-password").value
      });
      if (error) throw error;
      await authorize(data.user);
    } catch (error) {
      errorLabel.textContent = error.message || "Sign-in failed. Check your credentials and Supabase setup.";
      errorLabel.hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = "Sign in →";
    }
  });

  $("#logout-button").addEventListener("click", async () => {
    const { error } = await client.auth.signOut();
    if (error) {
      announce(`Could not sign out: ${error.message}`, true);
      return;
    }
    user = null;
    content = null;
    $("#app").hidden = true;
    $("#login-screen").hidden = false;
  });
  $("#main-nav").addEventListener("click", (event) => {
    const button = event.target.closest("[data-page]");
    if (button) showPage(button.dataset.page);
  });
  $("#preview-button").addEventListener("click", () => window.open("/", "_blank", "noopener,noreferrer"));
  $("#publish-button").addEventListener("click", publishContent);
  $("#project-form").addEventListener("submit", saveProject);
  $("#add-image").addEventListener("click", () => addImageRow());
  $("#close-dialog").addEventListener("click", () => $("#project-dialog").close());
  $("#cancel-dialog").addEventListener("click", () => $("#project-dialog").close());

  async function restoreSession() {
    if (!client) return;
    const { data, error } = await client.auth.getSession();
    if (error) {
      announce(`Could not restore sign-in: ${error.message}`, true);
      return;
    }
    if (data.session?.user) {
      try {
        await authorize(data.session.user);
      } catch (authorizationError) {
        announce(authorizationError.message || "Could not open the admin dashboard.", true);
      }
    }
  }

  restoreSession();
})();
