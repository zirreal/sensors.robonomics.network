<template>
    <div class="buySensor">
        <div class="buySensor-grid">
            <a class="buySensor-preview" href="https://robonomics.network/devices/altruist/" target="_blank" rel="noopener">
              <img v-if="animated" alt="" src="../assets/altruist-device/altruist-animated-10loops.gif" />
              <template v-else>
                <img alt="" :src="selectedImage" />
              </template>
              <span>New</span>
            </a>
            <div>
                <!-- <h3>{{ $t("header.buySensorTitle") }}</h3> -->
                <h3>Indiegogo campaign for the Bundle</h3>
                <!-- <p>{{ $t("header.buySensorText") }}</p> -->
                <p>Air Quality Sensor Altruist in a unique 3D-printed box with high-quality hardware, now in new bundle version: Indoor & Outdoor + Add-ons. Measure even more – don't tie yourself to corporate clouds. Enjoy all benefits of an open, independent product.</p>
                <a
                    href="https://robonomics.network/devices/altruist/"
                    target="_blank"
                    rel="noopener"
                    class="button"
                    >GoGo with New Altruist</a>
                  <!-- <p>
                    <b><a
                    href="https://robonomics.network/devices/altruist/"
                    target="_blank"
                    rel="noopener"
                    >{{ $t("header.buySensorLink") }}</a></b>
                </p> -->
            </div>
        </div>
    </div>
</template>

<script setup>
  import { ref } from "vue";

  const props = defineProps({
    animated: {
      type: Boolean,
      default: false
    }
  });

  import blueImg from '@/assets/altruist-device/Altruist-New-Box-Blue.png';
  import pinkImg from '@/assets/altruist-device/Altruist-New-Box-Pink.png';
  import yellowImg from '@/assets/altruist-device/Altruist-New-Box-Yellow.png';

  const images = [ blueImg, pinkImg, yellowImg ];

  const selectedImage = ref(
    images[Math.floor(Math.random() * images.length)]
  );

</script>

<style scoped>
.buySensor {
  padding: var(--gap);
  border: 1px solid #000;
  border-radius: 20px;
  font-weight: bold;
  margin: 40px 0;
  container-type: inline-size;
}

.buySensor-grid {
    display: grid;
    grid-template-columns: 150px auto;
    gap: 20px;
    font-size: 85%;
}

.buySensor-preview {
  position: relative;
  /* display: flex;
  align-items: center;
  justify-content: center; */
}

.buySensor-preview span {
  align-items: center;
  background-color: #000;
  border-radius: 20px;
  border: 2px solid #fff;
  color: #fff;
  display: flex;
  font-size: 0.8rem;
  height: 40px;
  justify-content: center;
  left: 0;
  position: absolute;
  text-transform: uppercase;
  top: 0;
  width: 40px;
}

.buySensor-preview img {
  display: inline-block;
  max-width: 100%;
  padding: var(--gap);
}

@container (width > 600px) {
  .buySensor-grid {
    font-size: 110%;
    padding: 20px;
    gap: 40px;
  }

  .buySensor-grid h3 {
    font-size: 1.6rem;
  }
}
</style>