<template>
  <section>
    <p>
      <a
        href="https://github.com/airalab/sensors.robonomics.network"
        target="_blank"
        rel="noopener"
      >
      <b>{{ repoName }} {{ latestRelease }}</b>
      </a>
    </p>
    <div><b>{{ $t('Secured by') }}</b></div>
    <img
      alt=""
      src="../assets/images/polkadot-new-dot-logo-horizontal.svg"
      class="polkadotLogo"
    />
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import config from '@config';

// Use the repo name from your config
const repoName = ref(config.REPO_NAME);

// Holds the tag name of the latest release
const latestRelease = ref('loading...');

onMounted(async () => {
  try {
    // Fetch the latest release info from GitHub API
    const res = await fetch(
      `https://api.github.com/repos/${repoName.value}/releases/latest`
    );

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const json = await res.json();
    // GitHub uses the `tag_name` field for release tags
    latestRelease.value = json.tag_name;
  } catch (e) {
    console.error('Error fetching latest release:', e);
    latestRelease.value = '';
  }
})
</script>

<style scoped>
.polkadotLogo {
  display: inline-block;
  max-width: 100px;
}

section {
  text-align: center;
}
</style>
