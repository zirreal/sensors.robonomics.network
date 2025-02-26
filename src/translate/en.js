export default {
  header: {
    title: "Web3 public sensors map",
    text1:
      "Welcome to the decentralized opensource sensors map which operates with the sole intent of serving",
    link1: "the free will of individuals",
    text2:
      ", without any beneficiaries. It offers two distinct layers of decentralization at your choise: peer-to-peer connectivity for direct access to sensor data, and the federative concept for accumulating sensor data and displaying measurement history. Click",
    link2: "here",
    text3: "for further technical details.",
    addSensorTitle: "Add your sensor on this map",
    addSensorText1: "You can",
    addSensorLink1: "assemble your own sensor",
    addSensorText2:
      "using components available on the free market. Follow the instructions provided to",
    addSensorLink2: "connect your sensor to the map",
    addSensorText3:
      ". We welcome your participation and look forward to expanding our community together. Join us today!",
    addSensorLink3: "YouTube video guide",
  },
  measures: {
    title: "Air measurements information",
    PM10: "PM 10 (Particulate Matter 10) consists of atmospheric particles with a size of up to 10 micrometers, including dust, soot, and other pollutants. They can cause health problems by affecting breathing and contributing to respiratory diseases. Sources of PM 10 include industrial emissions, road dust, and fuel combustion. Monitoring and reducing PM 10 levels are important for maintaining clean air and promoting health.",
    pollutionScalePM10: {
      1: "0-50 µg/m³: Good air quality",
      2: "51-100 µg/m³: Moderate pollution",
      3: "101-250 µg/m³: Poor air quality",
      4: "251-350 µg/m³: High pollution",
      5: "351 µg/m³ and above: Very high pollution",
    },
    recsPM10Text:
      "In case of elevated levels of PM 10, it is recommended to take the following measures:",
    recsPM10: {
      1: "Limit the time spent outdoors.",
      2: "Avoid physical activities, especially for individuals with respiratory problems.",
      3: "Close windows and doors to reduce the entry of polluted air into indoor spaces.",
      4: "Use masks with good filtration when necessary.",
      5: "Monitor information about air quality and follow recommendations from local health authorities",
    },
    PM25: "PM 2.5 is atmospheric particles with a size of up to 2.5 micrometers, which include dust, soot, and smoke. They can be harmful to health, causing breathing problems, allergies, and cardiovascular diseases. Sources of PM 2.5 include industry, transportation, and household emissions. Monitoring and reducing their levels are important for health and clean air.",
    pollutionScalePM25: {
      1: "0-35 µg/m³: Good",
      2: "35-70 µg/m³: Satisfyingly",
      3: "70-150 µg/m³: Poor",
      4: "151-250 µg/m³: Very poor",
      5: "251 µg/m³ and above: Unacceptable",
    },
    recsPM25Text:
      "In case of elevated levels of PM 2.5, it is recommended to take the following measures:",
    recsPM25: {
      1: "Stay indoors with good ventilation.",
      2: "Avoid outdoor physical activities.",
      3: "Keep windows and doors closed.",
      4: "Use face masks with good filtration.",
      5: "Monitor the air quality forecast.",
    },
    CO: "The particles of CO (carbon monoxide) outdoors represent gaseous pollution formed during incomplete combustion of hydrocarbons, especially in the exhaust gases of vehicles. Elevated levels of CO can have a negative impact on health, leading to poisoning. Restricting emissions and using protective masks can help reduce CO levels and improve air quality.Outdoors, the level of CO pollution (carbon monoxide) is typically measured in milligrams per cubic meter (mg/m³) of air.",
    pollutionScaleCOText: "The scale of CO pollution levels can be as follows:",
    pollutionScaleCO: {
      1: "0-2 mg/m³: Low pollution level",
      2: "2-4 mg/m³: Moderate pollution level",
      3: "4-14 mg/m³: High pollution level",
      4: "14 mg/m³ and above: Very high pollution level",
    },
    recsCOText: "In case of elevated levels of CO outdoors, it is recommended to:",
    recsCOText2:
      "These recommendations will help reduce the impact of carbon monoxide on health and provide greater protection.",
    recsCO: {
      1: "Limit the time spent outdoors.",
      2: "Avoid physical activity, especially for individuals with respiratory problems.",
      3: "Close windows and doors to reduce the entry of polluted air into indoor spaces.",
      4: "Use masks with good filtration when necessary.",
      5: "Monitor information about air quality and follow recommendations from local health authorities.",
    },
    GO: "Radiation is energy transmitted in the form of particles or waves. Ionizing radiation (high energy) can cause ionization of atoms and molecules, which can be harmful to health. Non-ionizing radiation (low energy) has less impact but can still have various effects on the body. It is important to follow safety recommendations to minimize potential risks from radiation.The radiation scale is measured in units of exposure called 'sieverts' (Sv). Health risks from radiation increase with the dose.",
    pollutionScaleGO: {
      1: "<= 2.1 µSv/h and below: Background radiation level, usually safe.",
      2: "<= 10 µSv/h: Moderate radiation level, may be safe for most people, but prolonged exposure may require monitoring.",
      3: "<= 100 µSv/h: Elevated radiation level, caution is needed.",
      4: "100 µSv/h and above: High radiation level, poses a health risk.",
    },
    pollutionScaleGOText:
      "Guidelines considered safe for long-term living typically range around 1-2 µSv/h (1000-2000 nanosieverts per hour) or less. However, short-term outdoor exposure at levels above 10 µSv/h does not pose a significant threat to health. It is important to adhere to recommendations and instructions from local health authorities, especially in areas with increased radiation risk.",
    recsGOText:
      "Please consult local authorities and radiation safety experts for specific recommendations tailored to your area and situation.",
    NH3: "Ammonia. It is capable of causing toxic pulmonary edema and severe damage to the nervous system when inhaled. The maximum single concentration is 0.2 mg/m3, the average daily concentration is 0.4 mg/m3.",
    NO2: "Nitrogen oxide. Poisonous red-brown gas with a sharp unpleasant odor or yellowish liquid. The source is the combustion of various types of fuel. NO2 in the atmosphere can cause acid rain and irritation of mucous membranes. The maximum single concentration is 0.085 mg/m3, the average daily concentration is 0.4 mg/m3.",
    TMP: "'Tmp' in the context of outdoor air indicators usually refers to air temperature. It is a measurable parameter that determines the thermal conditions of the environment. Air temperature can vary depending on the season and geographic location, influencing the comfort of being outdoors and requiring appropriate clothing and protection.",
    pollutionScaleTMPText:
      "The scale of outdoor air temperature conditions for humans can be as follows:",
    pollutionScaleTMP: {
      1: "-10°C / 14°F and below - Very cold",
      2: "-10 to 0°C / 14 to 32°F - Cold",
      3: "0 to 10°C / 32-50°F - Cool",
      4: "10 to 25°C / 50-77°F - Warm.",
      5: "25°C / 77°F and above - Very warm",
    },
    recsTMPText: "During very cold temperatures:",
    recsTMP1: {
      1: "Wear warm clothing and accessories to prevent frostbite.",
      2: "Avoid prolonged exposure outdoors and stay in warm spaces.",
    },
    recsTMPText2: "During very hot temperatures:",
    recsTMP2: {
      1: "Wear lightweight clothing and a hat for sun protection.",
      2: "Drink an adequate amount of water to avoid dehydration.",
      3: "Avoid direct sunlight during peak heat hours and seek a cool place if signs of heatstroke appear.",
    },
    HM: "Air humidity is a measure of the water vapor content in the atmosphere. The optimal humidity level for comfort and health is in the range of 40% to 60%. High humidity can cause stuffiness, while low humidity can lead to dryness. Measuring humidity is useful for controlling the indoor air climate.",
    pollutionScaleHMText: "Humidity levels can be categorized as follows:",
    pollutionScaleHMText2:
      "The optimal humidity level may vary depending on individual preferences and climatic conditions.",
    pollutionScaleHM: {
      1: "< 30% - Very dry",
      2: "30 - 40% - Dry",
      3: "40 - 60% - Comfortable",
      4: "60 - 70% - Humid",
      5: "> 70% - Very humid",
    },
    recsHMText: "During low outdoor humidity:",
    recsHM1: {
      1: "Moisturize your skin and mucous membranes.",
      2: "Drink an adequate amount of water.",
      3: "Avoid prolonged exposure to the sun.",
    },
    recsHMText2: "During high outdoor humidity:",
    recsHM2: {
      1: "Avoid physical activity during hot and humid times of the day.",
      2: "Wear lightweight, breathable clothing.",
      3: "Protect yourself from direct sunlight.",
      4: "Drink an adequate amount of water.",
      5: "Seek a cool place and use fans or air conditioning.",
    },
  },
  provider: {
    realtime: "Real time",
  },
  layer: {
    wind: "Wind",
    messages: "Messages",
  },
  details: {
    user: "User #",
    photos: "Photos",
    showpath: "Show route",
    copied: "Sensor id copied",
  },
  history: {
    city: "Locality",
    period: "Calendar period",
    currentDay: "Current day",
    currentMonth: "Last month",
    chooseDates: "Select dates",
    title: "Import data",
    button: "Download csv file",
  },
  notice_with_fz:
    "The specified data is not legally significant information for general use and special information in accordance with the federal law of July 19, 1998 no 113-fz «On the hydrometeorological service»",
  notice_without_fz:
    "This information holds no legal validity and is intended solely for personal use.",
  sensorpopup: {
    infotitle: "Advanced information",
    bookmarkplaceholder: "A name for sensor",
    bookmarkbutton: "Add to Bookmarks",
    infosensorid: "Sensor id",
    infosensorgeo: "Sensor geoposition",
    infosensorowner: "Sensor owner",
    infosensordonated: "Donated by",
  },
  bookmarks: {
    listtitle: "Your bookmarked sensors",
    listempty: "Save any sensor from the map here for quicker access",
  },
  links: {
    measurement: "Measurements guide",
    github: "GitHub repository",
    privacy: "Privacy policy",
  },
  scales: {
    title: "Units of measurement",
    upto: "up to",
    above: "above",
  },
  showlocation: "Show my location",
  locationloading: "Trying to get your location",
  isLoad: "Load...",
  geolocationdefault: "Geolocation is set default data",
  geolocationlocal: "Geolocation is set from local data",
  geolocationisdetermined: "Geolocation is determined",
  geolocationerror: "Geolocation is not established [code -",
  geolocationnotavailable: "Geolocation is not available",
  geolocationdefaultsetup: "setting up default position...",
  privacypolicy: {
    title: "Privacy Policy",
    description:
      "This Policy describes the information we collect from you, how we use that information and our legal basis for doing so. It also covers whether and how that information may be shared and your rights and choices regarding the information you provide to us.",
    subtitle1: "Where are those annoying cookie consent pop-ups?",
    text1: "We don't need cookie consent is needed because:",
    listitem1: "Tracking cookies are not used",
    listitem2: "The data is not used for any other purpose than analytics",
    listitem3: "Visitors aren’t tracked across websites",
    listitem4: "A user cannot be tracked across days within the same website",
    subtitle2: "What We Collect and Receive",
    text2:
      "In order for us to provide you the best possible experience on our websites, we need to collect and process certain information. Depending on your use of the Services, that may include:",
    listitem5bold: "Contact us via email",
    listitem5:
      "— for example, when you submit our forms, send us questions or comments, or report a problem, we will collect your name, email address, message, etc. We use this data solely in connection with answering the queries we receive.",
    listitem6bold: "Usage data",
    listitem6text1:
      "— when you visit our website, we will store: the URL from which you visited us from, web pages of our website you visit, the date and duration of your visit, your anonymized IP address, the device specifications (device type, operating system, screen resolution, language, country you are located in, and web browser type) you used during your visit, and",
    listitem6link1: "other",
    listitem6text2:
      "non-personal data. We process this usage data only on our server, not passing it to third-parties with",
    listitem6link2: "Matomo",
    listitem6text3:
      " web analytics platform that gives us 100% data ownership. This analytics helps us to improve user experience with our website and to recognize and stop any misuse.",
    listitem7bold: "Non-personalized cookies",
    listitem7:
      "— we use non-tracking cookies (small data files transferred onto computers or devices by sites) for record-keeping purposes and to enhance functionality on our website. You may deactivate or restrict the transmission of these cookies by changing the settings of your web browser or by opt-out on this page in the form below. Cookies that are already stored may be deleted at any time.",
    subtitle3: "Your Rights",
    text3:
      "You have the right to be informed of Personal Data processed by Matomo, a right to rectification/correction, erasure and restriction of processing. You also have the right to ask from us a structured, common and machine-readable format of Personal Data you provided to us.",
    text4:
      "We can only identify you via your email address and we can only adhere to your request and provide information if we have Personal Data about you through you having made contact with us directly and/or you using our site and/or service. We cannot provide, rectify or delete any data that we store on behalf of our users or customers.",
    text5:
      "To exercise any of the rights mentioned in this Privacy Policy and/or in the event of questions or comments relating to the use of Personal Data you may contact us.",
    text6:
      "In addition, you have the right to lodge a complaint with the data protection authority in your jurisdiction.",
    subtitle4: "Retention of data",
    text7:
      "We will retain your information as long as necessary to provide you with the services or as otherwise set forth in this Policy. We will also retain and use this information as necessary for the purposes set out in this Policy and to the extent necessary to comply with our legal obligations, resolve disputes, enforce our agreements and protect Robonomics Cloud legal rights.",
    text8:
      "We also collect and maintain aggregated, anonymized or pseudonymized information which we may retain indefinitely to protect the safety and security of our Site, improve our Services or comply with legal obligations.",
    matomooptout: "Opt-out of website tracking",
    matomodescription: "You can opt out of being tracked by our Matomo Analytics instance below:",
    matomolabel1: "You are currently opted out. Click here to opt in.",
    matomotext1:
      "Opt-out complete; your visits to this website will not be recorded by the Web Analytics tool. Note that if you clear your cookies, delete the opt-out cookie, or if you change computers or Web browsers, you will need to perform the opt-out procedure again.",
    matomotext2: "Please click below to opt in:",
    matomolabel2: "You are currently opted in. Click here to opt out.",
    matomotext3:
      "You may choose not to have a unique web analytics cookie identification number assigned to your computer to avoid the aggregation and analysis of data collected on this website.",
    matomotext4: "To make that choice, please click below to receive an opt-out cookie",
  },
};
