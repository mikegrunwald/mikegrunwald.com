<script>
  // your script goes here
</script>

<svelte:head>
  <title>Michael Grunwald | Product Samples</title>
  <link href="https://vjs.zencdn.net/8.22.0/video-js.css" rel="stylesheet" />
  <script src="https://vjs.zencdn.net/8.22.0/video.min.js"></script>
</svelte:head>

<section class="content">
  <header class="page-header">
    <h1 class="h1">Michael Grunwald's Product focused work samples :</h1>
  </header>

  <h2 class="h3">Web Apps</h2>
  <hr />

  <article class="project">
    <header class="project-header">
      <h3 class="h2">Hubspot</h3>
    </header>
    <div class="gallery">
      <img src="/images/projects/hubspot/GROW Video Session.gif" alt="" />
      <img src="/images/projects/hubspot/GROW Networking.gif" alt="" />
      <img src="/images/projects/hubspot/GROW On-Demand.gif" alt="" />
      <img src="/images/projects/hubspot/GROW Topic Chat.gif" alt="" />
    </div>
    <video
      class="video-js"
      controls
      preload="auto"
      poster="/images/projects/hubspot/inbound-poster.png"
      src="/video/inbound-22.mp4"
      muted
    />
    <p>
      This project is incredibly precious to me. It’s the only one that has ever moved me to tears,
      not once, but twice. During the height of the Covid pandemic, HubSpot had to pivot and host
      their three-day marketing conference virtually, reaching over 75,000 people across the globe.
      I was deeply involved in this effort, working on a total of six conferences over a two-year
      span. These included INBOUND 2021 and 2022, as well as the GROW series in both EMEA (Europe,
      Middle East & Africa) and ANZ (Australia & New Zealand) for 2021 and 2022.
    </p>
    <ul class="bullets">
      <li>
        I was one of the FEs in charge of building out some of the more interactive 2D features in
        the application
      </li>
      <li>real-time messaging</li>
      <li>
        attendee networking sections
        <ul>
          <li>draggable grid of user cards</li>
          <li>messaging features</li>
          <li>data integration</li>
        </ul>
      </li>
      <li>
        giftbag sections
        <ul>
          <li>similar UI to networking</li>
        </ul>
      </li>
      <li>OnDemand playback sections</li>
      <li>Sponsors grid sections</li>
      <li>User profile management screens</li>
      <li>
        worked closely with the designer to create a design system
        <ul>
          <li>
            Implemented CSS custom properties into 100% of the component library that made theming
            super easy from both a layout and dev perspective
          </li>
        </ul>
      </li>
    </ul>
  </article>

  <article class="project">
    <header class="project-header">
      <h3 class="h2">GE Avuri</h3>
    </header>
    <video
      class="video-js"
      controls
      preload="auto"
      poster="/images/projects/avuri-poster.png"
      src="/video/avuri-demo.mp4"
    />
    <p>
      We created what is essentially a large-scale solution to medical device configuration
      management. There's a huge array of devices administrators have to keep track of and maintain
      within hospitals (ultrasounds, MRI, cardiovascular, ventilators, patient monitoring, etc.).
      Most of these have configurations that can be exported/imported and previously it's been a
      very manual process, but they recently figured out a way to do it over the internet but they
      needed a UI. In collaboration with our client, we were able to develop a platform that allows
      them to manage everything from a simple web interface. They handled all of the back-end and we
      simply implement API endpoints.
    </p>
    <ul class="bullets">
      <li>The UI uses tiles to represent devices in a dashboard</li>
      <li>It incorporates drag and drop functionality to sort and group devices into fleets</li>
      <li>
        There's a social aspect that allows administrators to share fleets, devices and specific
        configurations
      </li>
      <li>
        Clicking in to a device reveals detailed information like configuration history and recent
        activity
      </li>
      <li>
        Choosing a specific configuration allows you to edit properties, save, delete, download and
        push to other devices or entire fleets of devices.
      </li>
    </ul>
  </article>

  <article class="project">
    <header class="project-header">
      <h3 class="h2">Operation Tripod</h3>
    </header>
    <video
      class="video-js"
      controls
      preload="auto"
      poster="/images/projects/tripod-poster.png"
      src="/video/operation-tripod.mp4"
    />
    <p>
      At Active Theory, I created the frontend interface for an internal ChatGPT tool, working
      closely with a backend developer who handled the model integrations. I led the design and
      motion work, shaping the entire user experience from layout to micro-interactions to feel
      intuitive and polished. The tool features three custom-trained models, each tailored for
      specific internal tasks, which users can easily switch between depending on their needs. It
      was a rewarding project that combined thoughtful design with powerful functionality and played
      a key role in streamlining how our team accessed and leveraged AI internally.
    </p>
  </article>

  <h2 class="h3">Ecommerce</h2>
  <hr />

  <article class="project">
    <header class="project-header">
      <h3 class="h2">Stella & Chewy's</h3>
    </header>
    <img class="project-image" src="/images/projects/s&cs.png" alt="" />
    <a href="https://stellaandchewys.com" target="_blank" class="button outline">See It</a>
  </article>

  <article class="project">
    <header class="project-header">
      <h3 class="h2">Kotur</h3>
    </header>
    <img class="project-image" src="/images/projects/kotur.png" alt="" />
    <a href="https://www.koturltd.com/" target="_blank" class="button outline">See It</a>
  </article>
</section>

<style>
  .content {
    pointer-events: auto;
  }

  hr {
    margin: 0 0 var(--spacing-sm);
  }

  h1 {
    text-align: center;
    margin-bottom: var(--spacing-base);
  }

  .h2 {
    letter-spacing: 0.03em;
    color: var(--color-primary);
  }

  .h3 {
    letter-spacing: 0.06em;
    margin-bottom: 0;
  }

  .project {
    margin-bottom: var(--spacing-base);
  }

  video {
    width: 100%;
    height: auto;
    margin: 0 auto;
    display: block;
    cursor: pointer;
  }

  img {
    width: 100%;
    height: auto;
    max-width: 1280px;
    margin: 0 auto;
    display: block;
  }

  .gallery {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-xs);
    margin-bottom: var(--spacing-xs);
  }

  .project-image {
    margin-bottom: var(--spacing-sm);
  }
</style>
