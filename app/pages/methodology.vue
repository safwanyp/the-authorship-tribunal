<script setup lang="ts">
useSeoMeta({
  title: 'Methodology / The Authorship Tribunal',
  description: 'How the Human or AI code quiz sources, normalizes, reviews, and publishes snippets.',
  ogTitle: 'Methodology / The Authorship Tribunal',
  ogDescription: 'A clear note on snippet sourcing, normalization, review, and limits for the code reading game.',
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <main id="main" class="court methodology-screen">
    <TribunalHeader action-to="/" action-label="Start" />

    <article class="methodology-copy">
      <header class="methodology-intro">
        <p class="kicker">Methodology</p>
        <h2>Game first, detector never.</h2>
        <p>
          This is an informal code-reading game.
          It is neither an AI detector, nor a benchmark.
        </p>
      </header>

      <section class="method-section">
        <h2>Human snippets</h2>
        <p>
          Human snippets are sourced from permissively licensed repositories at exact
          pre-2021 commits. Source repo, commit, path, line anchors, and license are kept in
          the public dataset and shown on completed result pages.
        </p>
      </section>

      <section class="method-section">
        <h2>AI snippets</h2>
        <p>
          AI snippets are generated from structured specs derived from normalized, anonymized
          human display code. Spec generation and code generation are separate pipeline steps
          with separate prompt metadata.
        </p>
      </section>

      <section class="method-section">
        <h2>Normalization</h2>
        <p>
          Comments and docstrings are stripped, top-level names and project-specific identifiers
          are anonymized, and both labels are formatted with the same formatter for their language.
          Local variable names are preserved where possible.
        </p>
      </section>

      <section class="method-section">
        <h2>Review</h2>
        <p>
          Generated AI snippets are syntax checked and reviewed as whole items. Reviewers (i.e. me) can
          accept or reject a pair, but do not manually edit AI code before publication.
        </p>
      </section>

      <section class="method-section">
        <h2>Limitations</h2>
        <p>
          Results are shaped by source selection, normalization choices, model behavior, language
          familiarity, and the tiny slice of code shown. Treat your score as a game result.
        </p>
      </section>

      <section class="method-section">
        <h2>Dataset</h2>
        <p>
          See <code>the public dataset</code> for the current launch records, attributions, and
          methodology notes.
        </p>
      </section>
    </article>
  </main>
</template>
