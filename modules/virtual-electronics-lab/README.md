# Virtuelles Elektroniklabor

Dieses Modul enthält die öffentliche, rein lokale Browser-Simulation für das
GerNetiX-Elektroniklabor. Es besitzt keine API, keine Persistenz und keine
Hardwareansteuerung. Identity bindet es ausschließlich über statische Routen
unter `/technik-labs/` ein.

Jedes Labor ist ein eigenes ES-Modul unter `labs/` und erfüllt denselben
kleinen Vertrag: `id`, `title`, `status`, `summary`, `mount(target)` und
`dispose()`. Dadurch kann ein Labor unabhängig weiterentwickelt werden, ohne
Identity-Funktionen oder andere Messgeräte zu verändern.

Enthalten sind Oszilloskop mit Zweikanal-Signalgenerator, Trigger, XY, FFT und
Frequenzzähler, Multimeter, Labornetzteil, LCR-Meter, Logikanalysator,
Spektrumanalysator und VNA. Spektrum und VNA sind ausdrücklich vereinfachte
Lernmodelle und keine Kalibrier- oder Geräteemulationen.
