# Helpers that render the YAML files in data/ as HTML for the site pages.
# Use them in chunks with `#| output: asis`.

library(htmltools)

site_data <- function(name) {
  root <- Sys.getenv("QUARTO_PROJECT_DIR", ".")
  yaml::read_yaml(file.path(root, "data", paste0(name, ".yml")))
}

# Emit as a raw HTML block so Pandoc doesn't read htmltools' indentation as code
out <- function(x) cat("```{=html}\n", as.character(x), "\n```\n\n", sep = "")

me <- "Bräm DS"

is_first_author <- function(p) startsWith(p$authors, me)

authors_html <- function(authors) {
  parts <- strsplit(authors, me, fixed = TRUE)[[1]]
  HTML(paste(htmlEscape(parts), collapse = as.character(tags$strong(me))))
}

media_by_id <- function() {
  media <- site_data("media")
  setNames(media, vapply(media, `[[`, "", "id"))
}

pub_entry <- function(p, media = media_by_id()) {
  links <- tagList(
    tags$a(href = paste0("https://doi.org/", p$doi), "DOI"),
    if (!is.null(p$code)) tags$a(href = p$code, "Code")
  )
  coverage <- NULL
  if (length(p$media)) {
    items <- lapply(media[unlist(p$media)], function(m) {
      tags$li(HTML(sprintf('<a href="%s">%s</a>: %s (%s, %s)', m$url, htmlEscape(m$outlet),
                           htmlEscape(m$title), m$lang, format(as.Date(m$date), "%b %Y"))))
    })
    coverage <- tags$details(class = "pub-media",
                             tags$summary(sprintf("In the media (%d)", length(items))),
                             tags$ul(items))
  }
  div(class = "pub",
      div(class = "pub-title", p$title),
      div(class = "pub-authors", authors_html(p$authors)),
      div(class = "pub-meta",
          tags$em(p$journal), paste0(" · ", p$year),
          if (is_first_author(p)) span(class = "badge text-bg-light pub-badge", "First author")),
      div(class = "pub-links", links),
      coverage)
}

pub_list <- function(pubs) {
  media <- media_by_id()
  for (p in pubs) out(pub_entry(p, media))
}

publications_by_year <- function() {
  pubs <- site_data("publications")
  years <- vapply(pubs, function(p) as.integer(p$year), 1L)
  for (y in sort(unique(years), decreasing = TRUE)) {
    cat("## ", y, "\n\n", sep = "")
    pub_list(pubs[years == y])
  }
}

publications_where <- function(...) {
  cond <- list(...)
  Filter(function(p) all(vapply(names(cond), function(k) identical(p[[k]], cond[[k]]), TRUE)),
         site_data("publications"))
}

# Generic dated list: one row per entry with a period/year column
timeline <- function(entries, when = "period", title = "title", sub = NULL, body = "description") {
  rows <- lapply(entries, function(e) {
    div(class = "tl-row",
        div(class = "tl-when", e[[when]]),
        div(class = "tl-what",
            div(class = "tl-title", e[[title]],
                if (isTRUE(e$invited)) span(class = "badge text-bg-light pub-badge", "Invited")),
            if (!is.null(sub) && !is.null(e[[sub]])) div(class = "tl-sub", e[[sub]]),
            if (!is.null(e[[body]])) div(class = "tl-body", e[[body]]),
            if (!is.null(e$slides)) div(tags$a(href = e$slides, "Slides"))))
  })
  out(div(class = "timeline", rows))
}

media_list <- function() {
  media <- site_data("media")
  out(tags$ul(class = "media-list", lapply(media, function(m) {
    tags$li(HTML(sprintf('<span class="tl-when">%s</span><a href="%s">%s</a>: <em>%s</em> (%s)%s',
                         format(as.Date(m$date), "%b %Y"), m$url, htmlEscape(m$outlet),
                         htmlEscape(m$title), m$lang,
                         if (is.null(m$note)) "" else paste0(", ", htmlEscape(m$note)))))
  })))
}
