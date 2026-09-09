/* ============================================================================
   details.js — the detail sheet shown under the clip.
   Loaded by BOTH builds (index.html, work.html, mobile.html) so the service
   modal, the work modal and the phone's bottom sheet can never drift apart.

   ── HOW TO EDIT ────────────────────────────────────────────────────────────
   Every row under "Details" is just a key in a `specs` object, and the renderer
   prints whatever it finds in order. So adding a row is adding a line:

       'Range Rover': { proc: 'ppf', specs: {
         Vehicle: 'Range Rover Autobiography',
         Service: 'Full-body PPF',
         Film:    'XPEL Ultimate Plus',      <-- new row, no code change
         'In studio': '4 days'               <-- quote keys that have a space
       }},

   Values here are either observable from the photograph or a description of how
   the studio works. Per-car specifics we do not have — film brand, hours in the
   booth, warranty registered against that VIN — are deliberately ABSENT rather
   than guessed. Add them and they appear.
   ========================================================================== */
(function (w) {
  'use strict';

  var STUDIO = 'Indirapuram, Ghaziabad';

  /* The published four-stage route, specialised per service family. These
     describe the studio's own process, not claims about an individual car. */
  var PROC = {
    ppf: [
      'Intake photos and paint depth readings on every panel',
      'Strip wash, chemical and mechanical decontamination',
      'Paint corrected first — film never goes over swirls',
      'Film cut and installed panel by panel in the filtered booth',
      'Edges sealed, cured, then re-inspected under LED'
    ],
    cppf: [
      'Intake photos and paint depth readings on every panel',
      'Strip wash and full decontamination',
      'Colour film wrapped panel by panel, seams planned around body lines',
      'Edges tucked and post-heated, then cured',
      'Original paint left untouched underneath — fully reversible'
    ],
    matte: [
      'Intake photos and paint depth readings on every panel',
      'Strip wash and full decontamination',
      'Matte film installed panel by panel',
      'Finish checked for shine-through and edge lift under LED'
    ],
    ceramic: [
      'Intake photos and paint depth readings on every panel',
      'Strip wash, decontamination and clay',
      'Multi-stage machine polish under calibrated lighting',
      'Panels wiped down and coated in the filtered booth',
      'Cured, then re-inspected before the keys come back'
    ],
    correction: [
      'Paint depth readings on every panel before a pad touches the car',
      'Strip wash and full decontamination',
      'Multi-stage machine polish — machined out, never filled',
      'Finish checked for a clean reflection under calibrated light'
    ],
    detail: [
      'Full exterior and interior assessment, panel by panel',
      'Strip wash, decontamination, wheels, arches and shuts',
      'Paint machine-polished where the finish needs it',
      'Glass, trim and cabin taken back to zero-mile condition',
      'Final inspection under LED before handover'
    ],
    interior: [
      'Full interior assessment including headlining and boot',
      'Dry extraction and vacuum through every seam',
      'Leather, alcantara and fabric deep-cleaned by material',
      'Conditioned and sealed, not dressed with shine'
    ],
    sunfilm: [
      'Glass cleaned and prepped inside and out',
      'Film cut to each window',
      'Heat-shrunk to the curve and squeegeed out',
      'Cured, then checked for clarity and clean edges'
    ],
    wash: [
      'Pre-rinse and snow foam, left to dwell',
      'Contact wash with wheels and arches done first',
      'Chemical decontamination where the paint needs it',
      'Hand-dried and quick-detailed, glass finished last'
    ]
  };

  /* ---- the ten services (home page modal + phone rail) ----------------- */
  var SERVICES = {
    'Paint Protection Film': { proc: 'ppf', specs: {
      Service: 'Paint protection film', Finish: 'Gloss, self-healing',
      Coverage: 'Front end, partial or full body', Studio: STUDIO } },

    'Coloured PPF': { proc: 'cppf', specs: {
      Service: 'Coloured paint protection film', Finish: 'Colour change — reversible',
      Coverage: 'Full body', Studio: STUDIO } },

    'Matte PPF': { proc: 'matte', specs: {
      Service: 'Matte paint protection film', Finish: 'Matte, self-healing',
      Coverage: 'Front end, partial or full body', Studio: STUDIO } },

    'Ceramic Coating': { proc: 'ceramic', specs: {
      Service: 'Nano-ceramic coating', Finish: 'Gloss, hydrophobic',
      Coverage: 'Paint, glass and wheels on request', Studio: STUDIO } },

    'Graphene Coating': { proc: 'ceramic', specs: {
      Service: 'Graphene coating', Finish: 'Gloss, heat-tolerant, hydrophobic',
      Coverage: 'Paint, glass and wheels on request', Studio: STUDIO } },

    'Paint Correction': { proc: 'correction', specs: {
      Service: 'Multi-stage paint correction', Finish: 'Corrected clear coat',
      Coverage: 'Every painted panel', Studio: STUDIO } },

    'Detailing': { proc: 'detail', specs: {
      Service: 'Full detail', Finish: 'Zero-mile condition',
      Coverage: 'Exterior and interior', Studio: STUDIO } },

    'Interior Spa': { proc: 'interior', specs: {
      Service: 'Interior deep clean', Finish: 'Cleaned, conditioned and sealed',
      Coverage: 'Leather, alcantara, fabric, trim and glass', Studio: STUDIO } },

    'Sunfilm': { proc: 'sunfilm', specs: {
      Service: 'Sun film', Finish: 'Heat and UV rejection',
      Coverage: 'All glass or as specified', Studio: STUDIO } },

    'Car Wash': { proc: 'wash', specs: {
      Service: 'Maintenance wash', Finish: 'Clean, decontaminated, hand-dried',
      Coverage: 'Exterior, wheels and glass', Studio: STUDIO } }
  };

  /* ---- the nine finished cars (work page + phone grid) ------------------
     Model names read off the studio's own photographs — correct any that are
     wrong, they are the one thing here that is an observation, not a process. */
  var WORK = {
    'Range Rover': { proc: 'ppf', specs: {
      Vehicle: 'Range Rover', Service: 'Full-body paint protection film',
      Finish: 'Gloss, self-healing', Coverage: 'Full body', Studio: STUDIO } },

    'Colour Change': { proc: 'cppf', specs: {
      Vehicle: 'BMW', Service: 'Coloured PPF colour change',
      Finish: 'Gloss colour film — paint untouched', Coverage: 'Full body', Studio: STUDIO } },

    'Concours Detail': { proc: 'detail', specs: {
      Vehicle: 'Mercedes-Maybach GLS', Service: 'Full concours detail',
      Finish: 'Zero-mile condition', Coverage: 'Exterior and interior', Studio: STUDIO } },

    'Ceramic Build': { proc: 'ceramic', specs: {
      Vehicle: 'Mercedes-Benz S-Class', Service: 'Correction and ceramic coating',
      Finish: 'Gloss, hydrophobic', Coverage: 'Paint, glass and wheels', Studio: STUDIO } },

    'Satin Wrap': { proc: 'cppf', specs: {
      Vehicle: 'Range Rover', Service: 'Coloured PPF, satin finish',
      Finish: 'Satin — paint untouched', Coverage: 'Full body', Studio: STUDIO } },

    'Graphene Layer': { proc: 'ceramic', specs: {
      Vehicle: 'BMW M3', Service: 'Graphene coating',
      Finish: 'Gloss, heat-tolerant', Coverage: 'Paint and wheels', Studio: STUDIO } },

    'Matte Finish': { proc: 'matte', specs: {
      Vehicle: 'Audi Q8', Service: 'Matte paint protection film',
      Finish: 'Matte, self-healing', Coverage: 'Full body', Studio: STUDIO } },

    'Front Armour': { proc: 'ppf', specs: {
      Vehicle: 'Range Rover', Service: 'Front-end paint protection film',
      Finish: 'Gloss, self-healing', Coverage: 'Bonnet, bumper, wings, mirrors', Studio: STUDIO } },

    'Wash Bay': { proc: 'wash', specs: {
      Vehicle: 'Mercedes-Benz', Service: 'Maintenance wash',
      Finish: 'Clean, decontaminated, hand-dried', Coverage: 'Exterior, wheels and glass', Studio: STUDIO } }
  };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** Look a title up in either table — work first, since a clip basename can
   *  be shared between a service card and a finished car. */
  function find(title) { return WORK[title] || SERVICES[title] || null; }

  /** The block that goes under the video. Returns '' when nothing is filed,
   *  so a new card without an entry degrades to just its description. */
  function html(title) {
    var d = find(title);
    if (!d) return '';
    var steps = PROC[d.proc] || [];
    var out = '<div class="detail">';

    if (steps.length) {
      out += '<h4 class="detail__h label">What we did</h4><ol class="detail__scope">';
      steps.forEach(function (s) { out += '<li>' + esc(s) + '</li>'; });
      out += '</ol>';
    }

    var keys = Object.keys(d.specs || {});
    if (keys.length) {
      out += '<h4 class="detail__h label">Details</h4><dl class="detail__spec">';
      keys.forEach(function (k) {
        out += '<dt>' + esc(k) + '</dt><dd>' + esc(d.specs[k]) + '</dd>';
      });
      out += '</dl>';
    }
    return out + '</div>';
  }

  w.ZLAB_DETAILS = { html: html, find: find, proc: PROC, services: SERVICES, work: WORK };
})(window);
