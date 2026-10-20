(function () {
  const config = window.PORTFOLIO_SUPABASE;
  if (!config || !window.supabase) {
    console.error("Portfolio CMS could not start: Supabase configuration or SDK is missing.");
    return;
  }

  const client = window.supabase.createClient(config.url, config.publishableKey);
  const escapeText = (value) => String(value || "");
  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function renderProject(project, index) {
    const article = create("article", `project${project.dark ? " dark" : ""}`);
    const intro = create("div", "project-intro");
    const titleBlock = create("div");
    titleBlock.append(create("div", "project-number", `${String(index + 1).padStart(2, "0")} · ${escapeText(project.category || "Portfolio project")}`));
    titleBlock.append(create("h3", "", project.title));
    titleBlock.append(create("p", "project-subtitle", project.subtitle));

    const copyBlock = create("div", "project-copy");
    copyBlock.append(create("p", "", project.description));
    const projectFacts = (project.facts || []).slice(0, 3);
    if (projectFacts.length) {
      const facts = create("div", "facts");
      projectFacts.forEach((fact) => {
        const item = create("div", "fact");
        item.append(create("b", "", fact.label));
        item.append(create("span", "", fact.value));
        facts.append(item);
      });
      copyBlock.append(facts);
    }
    if (project.note) {
      const note = create("div", "role-note");
      note.textContent = project.note;
      copyBlock.append(note);
    }
    intro.append(titleBlock, copyBlock);
    article.append(intro);

    const images = (project.images || []).filter((image) => image.src).slice(0, 6);
    if (images.length) {
      const gallery = create("div", `gallery${images.length === 2 ? " two" : ""}`);
      images.forEach((image) => {
        const figure = create("figure", image.contain ? "contain" : "");
        const img = create("img");
        img.src = image.src;
        img.alt = image.alt || project.title || "Portfolio project image";
        img.loading = "lazy";
        figure.append(img);
        gallery.append(figure);
      });
      article.append(gallery);
    }
    return article;
  }

  function applyContent(content) {
    if (!content || typeof content !== "object") return;
    const identity = content.identity || {};
    if (identity.brand) {
      const brand = document.querySelector("header .logo");
      if (brand) brand.textContent = identity.brand;
    }
    if (identity.seoTitle) document.title = identity.seoTitle;
    if (identity.seoDescription) {
      const description = document.querySelector('meta[name="description"]');
      if (description) description.content = identity.seoDescription;
    }

    const hero = content.hero || {};
    const heroNode = document.querySelector(".hero");
    if (heroNode) {
      const eyebrow = heroNode.querySelector(".eyebrow");
      const heading = heroNode.querySelector("h1");
      const intro = heroNode.querySelector(".intro");
      if (eyebrow && hero.eyebrow) eyebrow.textContent = hero.eyebrow;
      if (heading && hero.title) {
        let title = hero.title.trim();
        if (
          !/\s/.test(title)
          && identity.brand
          && title.toLocaleLowerCase() === identity.brand.replace(/\s+/g, "").toLocaleLowerCase()
        ) {
          title = identity.brand;
        }
        const words = title.split(/\s+/);
        heading.replaceChildren();
        const firstLine = create("span", "", words.shift() || "");
        heading.append(firstLine);
        if (words.length) heading.append(create("span", "", words.join(" ")));
      }
      if (intro && hero.intro) intro.textContent = hero.intro;
      if (Array.isArray(hero.images) && hero.images.length) {
        heroNode.querySelectorAll(".hero-collage img").forEach((image, index) => {
          const source = hero.images[index];
          if (source) image.src = source;
        });
      }
    }

    const work = content.work || {};
    const workHeading = document.querySelector("#work .section-head h2");
    const workLead = document.querySelector("#work .section-head p");
    if (workHeading && work.title) workHeading.textContent = work.title;
    if (workLead && work.intro) workLead.textContent = work.intro;

    const about = content.about || {};
    const aboutCopy = document.querySelector("#about .about-grid > div:first-child");
    if (aboutCopy && Array.isArray(about.paragraphs)) {
      aboutCopy.replaceChildren(...about.paragraphs.map((text) => create("p", "", text)));
    }
    const aboutHeading = document.querySelector("#about .section-head h2");
    const aboutLead = document.querySelector("#about .section-head p");
    if (aboutHeading && about.title) aboutHeading.textContent = about.title;
    if (aboutLead && about.intro) aboutLead.textContent = about.intro;
    const skills = document.querySelector("#about .skills");
    if (skills && Array.isArray(about.skills)) {
      skills.replaceChildren(...about.skills.map((skill) => create("div", "", skill)));
    }
    const aboutNote = document.querySelector("#about .note");
    if (aboutNote && about.note) aboutNote.textContent = about.note;

    const workWrap = document.querySelector("#work .wrap");
    if (workWrap && Array.isArray(content.projects)) {
      let projects = workWrap.querySelector(":scope > .portfolio-project-list");
      if (!projects) {
        projects = create("div", "portfolio-project-list");
        workWrap.querySelectorAll(":scope > .project").forEach((project) => projects.append(project));
        workWrap.append(projects);
      }
      projects.replaceChildren(...content.projects.map(renderProject));
    }

    const contact = content.contact || {};
    const footerHeading = document.querySelector("footer h2");
    const emailLinks = document.querySelectorAll('a[href^="mailto:"]');
    if (footerHeading && contact.heading) footerHeading.textContent = contact.heading;
    if (contact.email) emailLinks.forEach((link) => {
      link.href = `mailto:${contact.email}`;
      if (link.closest("footer")) link.textContent = contact.email;
    });
    const languageNote = document.querySelector("footer .eyebrow");
    if (languageNote && contact.languages) languageNote.textContent = contact.languages;

    const sections = content.sections || {};
    [["work", "work"], ["about", "about"], ["contact", "contact"]].forEach(([key, id]) => {
      const section = document.getElementById(id);
      if (section && sections[key] === false) section.hidden = true;
    });

    const design = content.design || {};
    const root = document.documentElement;
    if (design.primary) root.style.setProperty("--red", design.primary);
    if (design.background) root.style.setProperty("--paper", design.background);
    if (design.text) root.style.setProperty("--ink", design.text);
    if (design.muted) root.style.setProperty("--muted", design.muted);
    if (design.bodyFont) root.style.setProperty("--body-font", design.bodyFont);
    if (design.headingFont) root.style.setProperty("--heading-font", design.headingFont);
    if (design.displayFont) root.style.setProperty("--display-font", design.displayFont);
    document.body.dataset.template = design.template || "editorial";
    const templateStyles = document.getElementById("portfolio-template-styles") || create("style");
    templateStyles.id = "portfolio-template-styles";
    templateStyles.textContent = `
      body[data-template="noir"] header{background:rgba(23,22,21,.94);border-color:#393633}
      body[data-template="noir"] .marquee{border-color:#d58b62}
      body[data-template="noir"] .button:not(.red){border-color:var(--ink)}
      body[data-template="noir"] .role-note{background:#292624;color:#f8f4ee}
      body[data-template="noir"] .hero-collage figure{background:#282624}
      body[data-template="noir"] .gallery figure{background:#282624}
      body[data-template="minimal"] h1,body[data-template="minimal"] h2,body[data-template="minimal"] h3{letter-spacing:-.035em}
      body[data-template="rose"] .marquee{background:#a7445b}
    `;
    document.head.append(templateStyles);
  }

  async function loadPublishedContent() {
    try {
      const { data, error } = await client
        .from("portfolio_site")
        .select("content")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        applyContent(data.content);
        return;
      }
    } catch (error) {
      console.error("Could not load published portfolio content from Supabase; trying the static published copy.", error);
    }

    try {
      const response = await fetch("/portfolio-content.json", { cache: "no-store" });
      if (response.ok) {
        applyContent(await response.json());
        return;
      }
      if (response.status !== 404) {
        console.error(`Could not load the static portfolio content: HTTP ${response.status}.`);
      }
    } catch (error) {
      console.error("Could not load the static published portfolio content.", error);
    }
  }

  loadPublishedContent();
})();
