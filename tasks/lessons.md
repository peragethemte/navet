# Lessons

- Never delete files from a live `/data` volume to "clean up probe artefacts". The real browser writes to the same store concurrently, and a partial delete (client registry gone, client preferences kept) wedges the profile store into a permanent 503. Probe against a throwaway container with a copied volume instead.

- A new view gated behind a card size nobody uses is invisible. The calendar card defaults to
  `medium`, so routing the new agenda and month views to `large` and above meant the feature shipped
  green on every check and changed nothing on the user's screen. Before calling UI work done, render
  it at the size the surface actually defaults to, not only at the size it looks best in. "Adapt
  intentionally at each size" is not a licence to silently ignore a setting the user chose.
