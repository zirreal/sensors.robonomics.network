<template>
  <div class="optout-form">
    <p>{{ optDescr }}</p>
    <p>{{ optChoice }}</p>
    <label class="custom-checkbox">
      <input
        @change="check($event)"
        type="checkbox"
        v-model="optOut"
        name="optout"
        value="optout"
        class="custom-checkbox__field"
      />
      <span class="custom-checkbox__content"></span>
      <strong>{{ optText }}</strong>
    </label>
  </div>
</template>

<script>
export default {
  data() {
    return {
      optOut: false,
      optText: "You are currently opted out. Click here to opt in",
      optDescr:
        "You may choose not to have a unique web analytics cookie identification number assigned to your computer to avoid the aggregation and analysis of data collected on this website.",
      optChoice: "To make that choice, please click below to receive an opt-out cookie",
    };
  },

  methods: {
    setOptOutText() {
      if (this.$matomo) {
        if (this.$matomo && this.$matomo.isUserOptedOut()) {
          this.optText = this.$t("privacypolicy.matomolabel1");
          this.optDescr = this.$t("privacypolicy.matomotext1");
          this.optChoice = this.$t("privacypolicy.matomotext2");
        } else {
          this.optText = this.$t("privacypolicy.matomolabel2");
          this.optDescr = this.$t("privacypolicy.matomotext3");
          this.optChoice = this.$t("privacypolicy.matomotext4");
        }
      }
    },

    check() {
      if (this.$matomo && this.$matomo.isUserOptedOut()) {
        this.$matomo && this.$matomo.forgetUserOptOut();
      } else {
        this.$matomo && this.$matomo.optUserOut();
      }
      this.setOptOutText();
    },
  },

  watch: {
    "$i18n.locale"() {
      this.setOptOutText();
    },
  },

  async mounted() {
    setTimeout(async () => {
      this.optOut = (await this.$matomo) && !this.$matomo.isUserOptedOut();
      this.setOptOutText();
    }, 300);
  },
};
</script>

<style scoped>
.optout-form {
  padding: 1.5rem 0.8rem;
  border: 2px solid #333;
}

.optout-form strong {
  padding-left: 10px;
}
</style>
