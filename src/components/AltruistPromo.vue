<template>
    <div class="buySensor">
        <div class="buySensor-grid">
            <a
                    href="https://robonomics.network/devices/altruist/"
                    target="_blank"
                    rel="noopener"
                    ><img alt="" src="../assets/altruist-animated-10loops.gif" /></a>
            <div>
                <h3>{{ $t("header.buySensorTitle") }}</h3>
                <p>{{ $t("header.buySensorText") }}</p>
                <p>
                    <b><a
                    href="https://robonomics.network/devices/altruist/"
                    target="_blank"
                    rel="noopener"
                    >{{ $t("header.buySensorLink") }}</a></b>
                </p>
            </div>
        </div>
    </div>
</template>

<style scoped>
.buySensor {
  padding: 10px;
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

.buySensor-grid img {
    display: block;
    max-width: 100%;
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