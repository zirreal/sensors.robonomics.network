<template></template>

<script setup>
import { reactive, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@vueuse/head'
import { useI18n } from 'vue-i18n'

import config from '@config'

const { locale: i18nLocale } = useI18n()

const props = defineProps({
  pageTitle: { type: String },
  pageDescription: { type: String },
  pageImage: { type: String },
  pageImageWidth: { type: String },
  pageImageHeight: { type: String }
})

const ogdata = reactive({
  site_name: config?.SITE_NAME || 'Sensors map',
  title: props.pageTitle || config?.TITLE || config?.SITE_NAME || 'Sensors map',
  description: props.pageDescription || config?.DESC || null,
  image: props.pageImage || null,
  image_width: props.pageImage ? props.pageImageWidth || '1280' : null,
  image_height: props.pageImage ? props.pageImageHeight || '765' : null,
  twitter: config?.TWITTER || null
})

const route = useRoute()
const fullUrl = computed(() => (config?.SITE_URL || '') + route.fullPath)

const locale = computed(() => {
  return i18nLocale.value || localStorage.getItem('locale') || 'en'
})

const meta = computed(() => [
  ogdata.description && { name: 'description', content: ogdata.description },

  { property: 'og:type', content: 'website' },
  ogdata.site_name && { property: 'og:site_name', content: ogdata.site_name },
  ogdata.title && { property: 'og:title', content: ogdata.title },
  ogdata.description && { property: 'og:description', content: ogdata.description },
  ogdata.image && { property: 'og:image', content: ogdata.image },
  ogdata.image && ogdata.image_width && { property: 'og:image:width', content: ogdata.image_width },
  ogdata.image && ogdata.image_height && { property: 'og:image:height', content: ogdata.image_height },
  { property: 'og:url', content: fullUrl.value },

  { name: 'twitter:card', content: 'summary_large_image' },
  ogdata.title && { name: 'twitter:title', content: ogdata.title },
  ogdata.image && { name: 'twitter:image', content: ogdata.image },
  ogdata.description && { name: 'twitter:description', content: ogdata.description },
  ogdata.twitter && { name: 'twitter:site', content: ogdata.twitter },
  ogdata.twitter && { name: 'twitter:creator', content: ogdata.twitter }
].filter(Boolean))

useHead({
  title: () => ogdata.title,
  htmlAttrs: {
    lang: () => locale.value,
    amp: true,
    dir: 'ltr'
  },
  meta: () => meta.value
})
</script>
