
<template>
  <MetaInfo
    pageTitle= "Login"
    :pageImage = "ogImage"
  />

  <PageTextLayout>
    <h3>Login for Altruist holder</h3>
    <form>
        <input type="password" placeholder="Pass phrase (12 words)" />
        <button class="button">Sign in</button>
    </form>
  </PageTextLayout>
</template>

<script setup>
// import {ref, watch } from 'vue';

import MetaInfo from '../components/MetaInfo.vue';
import PageTextLayout from "../components/layouts/PageText.vue";

const ogImage = new URL('@/assets/images/pages/login/og-login.webp', import.meta.url).href;
</script>

<style scoped>
  form {
    display: grid;
    gap: var(--gap);
    --app-inputpadding: 1.3rem;
  }

  input, button {
    display: block;
    width: 100%;
    height: auto;
  }
</style>