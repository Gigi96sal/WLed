Sto progettando un sistema Ambilight professionale completamente basato su ESP32 e desidero realizzare un progetto estremamente modulare, estendibile e mantenibile.

NON voglio ancora scrivere codice.

Voglio che tu realizzi un piano tecnico completo, dettagliato e professionale, che descriva come progettare l'intero sistema.

Il piano dovrà essere sufficientemente dettagliato da permettere, successivamente, di implementare il progetto utilizzando GPT-5.6 Terra per la generazione del codice.

Obiettivo

Realizzare un sistema composto da:

una ESP32 con WLED collegata ai LED;
due ESP32-S3-CAM con sensore OV2640;
connessione completamente cablata tra le tre ESP32.

Ogni ESP32-S3-CAM esegue un firmware completamente indipendente.

L'ESP32 con WLED esegue WLED modificato con un nuovo effetto chiamato Cinema.

Architettura generale

Le due ESP32-S3-CAM sono responsabili esclusivamente di:

acquisizione immagini;
elaborazione immagini;
estrazione dei colori;
invio dei dati.

L'ESP32 con WLED si occupa esclusivamente di:

ricevere i dati;
ricostruire il buffer LED;
applicare eventuali correzioni;
aggiornare i LED;
fornire l'interfaccia web di configurazione.

L'architettura dovrà seguire rigorosamente i principi SOLID, con responsabilità ben separate e dipendenze minime tra i moduli.

Hardware

Le telecamere saranno basate su:

ESP32-S3-CAM + OV2640.

Motiva questa scelta rispetto ad altre soluzioni.

Comunicazione

Analizza i protocolli disponibili e scegli quello migliore.

Valuta almeno:

SPI
UART
Ethernet

La scelta dovrà essere motivata considerando:

latenza;
semplicità di implementazione;
affidabilità;
espandibilità;
integrazione con ESP32;
integrazione con WLED;
quantità di dati prevista.

La comunicazione sarà esclusivamente via cavo.

Firmware ESP32-S3-CAM

Ogni ESP32-S3 dovrà:

acquisire immagini dalla propria OV2640;
avere FPS configurabili:
10
20
30
memorizzare le impostazioni tramite LittleFS;
elaborare ogni immagine;
estrarre solamente i colori appartenenti ai segmenti configurati;
costruire un Frame RGB;
inviarlo alla ESP32 con WLED.

La frequenza di acquisizione dovrà essere configurabile tramite file di configurazione.

Il firmware dovrà essere facilmente estendibile.

In futuro potrebbero essere aggiunti nuovi algoritmi, quindi l'architettura dovrà essere progettata pensando alla scalabilità.

Segmentazione

Le due telecamere osservano:

metà sinistra della TV;
metà destra della TV.

Le telecamere NON producono metà dei LED.

Producono solamente i LED appartenenti alla propria metà dello schermo.

Il sistema dovrà spiegare dettagliatamente come ottenere tali segmenti.

Calibrazione

Questa è la parte più importante del progetto.

Da WLED dovrà essere possibile aprire una pagina dedicata alla configurazione.

L'utente dovrà poter:

richiedere una fotografia alla telecamera sinistra;
richiedere una fotografia alla telecamera destra.

Le ESP32-S3 dovranno inviare un JPEG.

Sopra ogni fotografia dovrà comparire un quadrilatero deformabile.

L'utente potrà spostare esclusivamente i quattro vertici.

Lo scopo è delimitare perfettamente il bordo della TV.

Ogni telecamera vedrà solamente la propria metà.

Una volta salvata la configurazione:

le coordinate dovranno essere inviate alla relativa ESP32-S3.

Le ESP32 utilizzeranno tali coordinate per sapere esattamente quali porzioni dell'immagine utilizzare per estrarre i colori.

Il piano dovrà spiegare dettagliatamente:

formato delle coordinate;
trasformazione prospettica;
campionamento;
suddivisione automatica dei segmenti;
gestione delle deformazioni prospettiche.
Configurazione guidata

Alla prima apertura della pagina Cinema dovrà essere presente una procedura guidata composta da:

verifica connessione delle due ESP32-S3;
acquisizione fotografia sinistra;
selezione dei quattro vertici;
acquisizione fotografia destra;
selezione dei quattro vertici;
salvataggio configurazione;
test finale.

Il test finale dovrà accendere progressivamente i LED lungo il perimetro della TV per verificare che la mappatura sia corretta.

WLED

WLED dovrà essere modificato aggiungendo un nuovo effetto chiamato:

Cinema

L'effetto dovrà:

ricevere il Frame della telecamera A;
ricevere il Frame della telecamera B;
ricostruire il buffer LED completo;
applicare eventuali correzioni;
aggiornare i LED.
Mappatura LED

I LED saranno logicamente divisi in quattro lati:

Alto
Destro
Basso
Sinistro

Il LED zero potrà trovarsi in:

Alto sinistra
Alto destra
Basso sinistra
Basso destra

L'effetto Cinema dovrà funzionare indipendentemente dalla posizione del LED zero.

Il numero totale dei LED continuerà ad essere configurato normalmente tramite WLED.

Dovranno però esistere anche parametri aggiuntivi utilizzati solamente dall'effetto Cinema:

numero LED lato superiore;
numero LED lato inferiore;
numero LED lato sinistro;
numero LED lato destro.

Analizza la soluzione migliore tra:

costanti;
JSON;
configurazione nascosta;
altro.

Motiva la scelta.

L'effetto dovrà ricostruire correttamente il buffer LED indipendentemente dall'orientamento della strip.

Protocollo

Le ESP32 non dovranno inviare semplicemente un array RGB.

Dovranno inviare un Frame completo.

Progetta un protocollo proprietario versionato.

Ogni pacchetto dovrà contenere almeno:

Versione protocollo
Frame ID
Timestamp o contatore
Numero LED
FPS
Flag
Array RGB
CRC / Checksum

Il protocollo dovrà essere facilmente estendibile mantenendo la compatibilità futura.

Correzione colore

L'effetto Cinema dovrà integrare una sezione dedicata alla correzione colore.

Le correzioni dovranno essere applicate dopo la ricezione dei dati e prima dell'aggiornamento della strip.

Le impostazioni dovranno comparire nella UI di WLED.

Dovranno essere presenti almeno:

Color Boost

Incrementa la saturazione generale.

Dark Color Boost

Quando un colore è molto scuro, aumenta selettivamente saturazione e luminosità mantenendo la tonalità.

Esempio:

un marrone molto scuro potrà diventare un rosso caldo maggiormente percepibile.

L'obiettivo è evitare colori praticamente spenti.

Black Threshold

Definisce la soglia sotto la quale un colore viene considerato nero.

I colori sotto tale soglia dovranno spegnere il LED.

Serve ad eliminare il rumore video.

Smoothness

Filtro temporale.

Riduce gli sfarfallii tra frame consecutivi.

Slider regolabile.

Configurazione ESP32

Le ESP32-S3 utilizzeranno LittleFS.

Le impostazioni comprenderanno almeno:

FPS
coordinate quadrilatero
configurazione protocollo
impostazioni camera

L'architettura dovrà permettere facilmente l'aggiunta di nuove impostazioni.

Logging

Entrambi i firmware dovranno implementare un sistema di logging configurabile.

Livelli:

Error
Warning
Info
Debug
Gestione errori

Il piano dovrà spiegare come gestire:

perdita di un frame;
ritardo di una telecamera;
disconnessione di una telecamera;
timeout;
CRC errato;
riavvio di un dispositivo;
perdita della sincronizzazione.

Motiva le scelte progettuali.

Architettura software

Progetta completamente:

diagramma delle classi;
responsabilità;
moduli;
namespace;
struttura delle cartelle;
formato dei pacchetti;
macchina a stati;
gestione configurazione;
sincronizzazione;
comunicazione;
logging.

Ogni scelta dovrà essere motivata.

Roadmap

Suddividi il progetto in milestone.

Per ogni milestone indica:

obiettivo;
componenti da sviluppare;
test;
criteri di completamento.
Vincoli

L'intero progetto dovrà essere:

scritto in C++;
orientato agli oggetti;
modulare;
facilmente estendibile;
facilmente testabile;
compatibile con PlatformIO;
compatibile con ESP-IDF quando possibile;
facilmente portabile su hardware ESP32 futuri.
Output richiesto

Non scrivere codice.

Voglio un vero documento di progettazione software e hardware.

Ogni scelta dovrà essere motivata con vantaggi, svantaggi e possibili alternative.

Quando esistono più approcci progettuali, confrontali e scegli quello che ritieni migliore spiegandone il motivo.

Il risultato dovrà essere una vera Software & System Architecture Specification, pronta per guidare l'implementazione completa del progetto.

Esamino i vincoli già presenti in WLED e i punti di estensione più vicini (effetti, configurazione e UI) per trasformare la richiesta in un piano implementabile, senza modificare il codice.






Ho confermato le convenzioni WLED e i vincoli di sicurezza: il piano dovrà evitare allocazioni nel percorso frame, validare i pacchetti al primo ingresso e integrare la UI nei flussi di configurazione esistenti. Ora individuo i punti concreti per effetto, persistenza e pagina web, oltre alle opzioni di trasporto già supportate.







































La struttura WLED conferma che Cinema può essere un effetto nativo con metadati UI, mentre calibrazione e configurazione richiederanno una pagina protetta e endpoint dedicati anziché sovraccaricare i tre slider dell’effetto. L’opzione tecnicamente più equilibrata è una coppia di collegamenti UART differenziali RS-485 indipendenti: il flusso RGB è piccolo, la latenza è bassa e la stessa tratta gestisce foto JPEG a richiesta senza introdurre switch o moduli Ethernet su ogni camera.

Per chiudere le decisioni progettuali senza ipotesi nascoste, verifico l’effetto Frame RGB già presente e i limiti concreti della configurazione persistente. In parallelo ti chiedo di confermare la scelta del collegamento e i parametri fisici che definiscono budget e mappatura.































Analyzing your answers...

Q: Confermi due link UART full-duplex su RS-485, uno per camera, come scelta progettuale?
A: RS-485 su UART - Raccomandato: due link punto-punto, 2-3 Mbaud.
Q: Posso prescrivere l'hardware del controller WLED nel piano?
A: No, ho una scheda fissa - Indicherò modello, GPIO e memoria in un messaggio libero.
Q: Qual è il numero massimo realistico di LED lungo il perimetro?
A: Dai 300 ai 600 se scelgo led composti da 100led per metro, poco più della metà se scelgo 60led per metro
Q: Accetti un modulo Cinema nativo in un fork WLED, invece di un usermod esterno?
A: Sì, modulo nativo - Raccomandato.
La scelta di trasporto e di integrazione è ora definita: due canali RS-485/UART, uno per camera, e un modulo Cinema nativo nel fork WLED. Il dimensionamento di progetto sarà di 600 LED, così il caso 300 LED resta ampiamente coperto; mi manca solo l’identità della scheda WLED e delle due S3-CAM per riservare UART, alimentazione e pin senza conflitti.

Analyzing your answers...

Q: Qual è il modello esatto della scheda ESP32 che eseguirà WLED?
A: Scheda con WLED: Chip type: ESP32-D0WD-V3 (revision v3.1) Features: Wi-Fi, BT, Dual Core + LP Core, 240MHz, Vref calibration in eFuse, Coding Scheme None Crystal frequency: 40MHz
Q: Qual è il modello o pinout della ESP32-S3-CAM con OV2640?
A: ESP32-CAM invece per le 2 camere
Q: Qual è la lunghezza massima prevista per ciascun collegamento camera-WLED?
A: 1m / 1.5m
Il requisito delle camere è cambiato da ESP32-S3-CAM a ESP32-CAM classiche: lo recepisco, ma modifica disponibilità di pin, UART e prestazioni. Con collegamenti da 1–1,5 m RS-485 rimane adatto; per finalizzare senza assegnare GPIO immaginari devo identificare il modulo e sapere se dispone di PSRAM.

Analyzing your answers...

Q: Quale modello esatto di ESP32-CAM + OV2640 userai?
A: Modulo principale: AI-Thinker ESP32-CAM (la scheda nera con connettore FPC e fotocamera OV2640). Base di programmazione: ESP32-CAM-MB (la basetta inferiore su cui è incastrato il modulo CAM). e Sì, dispone di 4 MB di PSRAM esterna.
Q: La scheda WLED ha PSRAM esterna rilevabile da WLED?
A: Non ha psram esterna
Q: Le due camere saranno fissate frontalmente agli angoli superiore sinistro e superiore destro, con campo visivo sulla rispettiva metà?
A: Si possono mettere in alto o in basso, vanno configurate da esp32 con wled
I vincoli hardware sono chiari: controller WLED ESP32-D0WD-V3 senza PSRAM, due AI Thinker ESP32-CAM con 4 MB PSRAM e installazione configurabile in alto o in basso. Chiudo ora l’architettura con un profilo di memoria conservativo sul controller e una calibrazione che include posizione, rotazione e specchiatura per ciascuna telecamera.







































Il disegno è ora ancorato ai punti reali di estensione WLED: l’effetto FrameRGB esistente è solo un asset statico e non va riusato; Cinema avrà un controller di runtime separato, un effetto sottile e una configurazione cfg.json versionata. Sto consolidando l’ultima parte del piano: memoria senza PSRAM, sincronizzazione fra le due camere e test/fault handling.



















Ho verificato anche la gestione GPIO: Cinema dovrà riservare in modo atomico le quattro linee UART nel PinManager prima di inizializzare le due interfacce RS-485, quindi non potrà sovrapporsi a LED, pulsanti o usermod. Aggiorno ora il documento persistente con l’architettura completa e la roadmap eseguibile.



Nota di revisione: tutte le valutazioni e decisioni RS-485/UART riportate nella cronologia precedente sono obsolete. La specifica vincolante corrente inizia qui e usa esclusivamente SPI cablato.

Piano: Cinema Ambilight con trasporto SPI

Il progetto sarà un fork WLED con un modulo nativo Cinema e due firmware indipendenti per AI Thinker ESP32-CAM classiche con OV2640 e 4 MB di PSRAM. Questi moduli usano ESP32, non ESP32-S3. Il controller WLED attualmente noto è un ESP32-D0WD-V3 senza PSRAM; il dimensionamento massimo rimane 600 LED.

Decisioni architetturali

WLED sarà l'unico master SPI. Le due camere saranno slave indipendenti sullo stesso bus, con SCLK, MOSI e MISO condivisi e due chip-select separati, CS_LEFT e CS_RIGHT. Non verrà usato un collegamento daisy-chain: il master deve poter interrogare, diagnosticare e isolare ciascuna camera.
Il master avvia ogni transazione. Le camere non inviano dati spontaneamente: preparano l'ultimo frame completo in una mailbox e WLED lo preleva alternando i due chip-select. I nuovi frame sostituiscono quelli non ancora letti, privilegiando la latenza rispetto alla consegna di ogni frame.
La frequenza SPI sarà configurabile e partirà da un profilo conservativo di 4 MHz, SPI mode 0, MSB first. Il limite iniziale ammesso sarà 1-10 MHz e verrà aumentato solo dopo prove sul cablaggio reale.
Per cavi da 1-1,5 m, mantenere SCLK affiancato a massa, MOSI affiancato a massa e MISO affiancato a massa, aggiungere resistori serie da 22-47 ohm vicino al driver e alimentare tutte le schede con massa comune. SPI non nasce per queste distanze: il collaudo deve includere error rate e integrità del clock. Se il segnale non è affidabile, usare buffer o extender differenziali per segnali SPI senza cambiare il protocollo logico.
WLED salverà SCLK, MOSI, MISO, CS_LEFT e CS_RIGHT in `cfg.json.cinema.spi`; i cinque pin saranno obbligatori, distinti e riservati atomicamente tramite PinManager prima dell'avvio del bus. Il profilo iniziale verificato per ESP32 DOIT DevKit V1 30-pin è SCLK GPIO18, MOSI GPIO23, MISO GPIO19, CS_LEFT GPIO5 e CS_RIGHT GPIO17. Cinema rimane disabilitato finché l'utente non conferma la configurazione dalla UI; PinManager rifiuta eventuali collisioni con la configurazione WLED reale.
Sulle AI Thinker ESP32-CAM il bus HSPI slave riusa i GPIO microSD: SCLK GPIO14, MOSI GPIO13, MISO GPIO12 e CS GPIO15. La microSD deve rimanere disabilitata. GPIO12 richiede pull-down da 10 kOhm e GPIO15 pull-up da 10 kOhm per mantenere livelli di boot sicuri.
Il master usa l'host SPI2 dedicato instradato dalla GPIO matrix sui pin comunemente etichettati VSPI. In questo modo non condivide l'host SPI globale eventualmente usato da altre funzioni WLED.
Per lo streaming, acquisire in RGB565 QVGA ed estrarre i colori direttamente; per la calibrazione sospendere brevemente il flusso RGB e produrre JPEG.
Usare un controller WLED nativo, non un usermod: CinemaController gestisce frame e rendering; CinemaSpiMaster gestisce esclusivamente bus, polling e diagnostica. L'effetto `mode_cinema()` rende solo frame già validati.
Salvare la configurazione in `cfg.json.cinema`, versionata e migrabile. Non usare costanti nascoste o gli slider dell'effetto per geometria e pin.

Trasporto e protocollo

La libreria condivisa `cinema_protocol/` non dipende da Arduino o WLED. Il pacchetto binario contiene magic, versione, tipo, flag, ruolo nodo, sequenza, boot/session ID, request ID, payload length e CRC-32C.
SPI usa slot full-duplex di dimensione fissa e multipla di quattro byte, compatibili con DMA. Ogni slot ha un piccolo header di trasporto con magic, versione, flag, lunghezza del pacchetto, sequenza slot e CRC dell'header. Il resto contiene al massimo un pacchetto Cinema e padding a zero.
Uno slot vuoto permette al master di interrogare una camera senza inviare comandi. Durante la stessa transazione il master può trasmettere un comando pendente e ricevere la risposta o il frame che lo slave aveva preparato in precedenza. La risposta a un nuovo comando può arrivare dalla transazione successiva.
Il pacchetto interno conserva CRC-32C end-to-end. Il CRC dell'header SPI distingue uno slave non pronto, un bus flottante o una lunghezza corrotta prima di accedere al buffer.
COBS e delimitatori non sono necessari su SPI, perché la dimensione della transazione è nota. La versione SPI userà encode/decode di pacchetti raw con limiti stretti.
`FRAME_RGB` include generazione configurazione, frame ID, timestamp di cattura, FPS Q8.8, numero slot, formato RGB24, flag e array RGB ordinato.
Definire messaggi HELLO, HEARTBEAT, TIME_SYNC, CONFIG_STAGE, CONFIG_COMMIT, CONFIG_ROLLBACK, SNAPSHOT_*, FRAME_RGB, STATUS, LOG_EVENT, ACK, NACK ed ERROR.
Comandi e configurazioni sono idempotenti, identificati da request ID e confermati. Frame video persi o con CRC errato vengono scartati senza ritrasmissione.
Il master alterna le camere ogni circa 16 ms nel profilo 30 FPS: ciascuna camera viene letta ogni circa 32 ms. A velocità inferiori il periodo viene adattato per ridurre traffico e tempo bloccante.

Calibrazione e segmentazione

Rappresentare la TV nel piano canonico `(u,v)` con entrambe le coordinate in `[0,1]`. Camera Left possiede `u` in `[0,0.5]`; Camera Right possiede `u` in `[0.5,1]`.
Salvare i quattro vertici di ogni camera come coordinate normalizzate Q16, ordinate alto-sinistra, alto-destra, basso-destra, basso-sinistra. Le coordinate restano indipendenti dalla risoluzione JPEG e streaming.
Calcolare l'omografia prospettica `H` e l'inversa al salvataggio, quindi precomputare un piano di campionamento. Ogni LED usa una fascia interna al bordo TV e un piccolo kernel proiettato nell'immagine.
Ordinare il perimetro canonico: Alto sinistra-destra, Destro alto-basso, Basso destra-sinistra, Sinistro basso-alto. Assegnare ogni angolo una sola volta.
Richiedere quattro conteggi Top, Right, Bottom e Left, con somma uguale alla lunghezza del segmento Cinema. Le metà alto/basso sono ripartite fra camere; ogni lato verticale appartiene alla camera corrispondente.
La direzione fisica della strip rimane configurabile. Con offset angolare `o`, l'indice è `i=(p-o+N) mod N` in senso orario oppure `i=(o-p+N) mod N` in senso antiorario.

Firmware camera

Creare `cinema-camera/` come progetto PlatformIO separato per `board = esp32cam`, con LittleFS, configurazione transazionale, backup e recupero dopo perdita di alimentazione.
Strutturare CameraApp in ConfigRepository, CameraService, CalibrationModel, SamplingPlanBuilder, IColorExtractor, FramePublisher, SpiSlaveEndpoint, TimeSynchronizer e LogRouter.
SpiSlaveEndpoint possiede due slot DMA preallocati: uno viene trasmesso mentre l'altro viene preparato. Non alloca memoria durante le transazioni e non accede direttamente alla camera.
CaptureTask acquisisce a 10/20/30 FPS e pubblica solo frame completi. LinkTask gestisce la coda SPI slave e i comandi ricevuti. Le due task comunicano tramite code o notifiche FreeRTOS limitate.
Supportare posizione superiore/inferiore, flip e mirror. La geometria finale resta determinata dal quadrilatero calibrato.
PSRAM deve essere verificata a runtime con `psramFound()` e dimensione maggiore di zero. JPEG e framebuffer camera possono usare PSRAM; descrittori e buffer DMA SPI devono rimanere in memoria DMA-capable.

WLED e UI

`wled00/cinema/` contiene protocollo raw, codec slot SPI, CinemaSpiMaster, frame store, mapper perimetrale, color pipeline e diagnostica.
CinemaSpiMaster riserva atomicamente SCLK, MOSI, MISO, CS_LEFT e CS_RIGHT. Se un pin è assente, duplicato, non valido o già occupato, non inizializza SPI e Cinema resta in stato sicuro.
La riconfigurazione dei pin avviene nel loop principale, mai nel callback HTTP. Il vecchio bus viene arrestato e deallocato prima di applicare una configurazione valida nuova.
Usare un solo buffer RX e uno TX condivisi tra le due camere, allineati a quattro byte. Con frame store preallocato, il budget Cinema sul controller resta nell'ordine di 8-10 KB.
Applicare Black Threshold, Color Boost, Dark Color Boost e filtro EMA Smoothness dopo l'assemblaggio e prima di `Segment::setPixelColor`. WLED mantiene luminosità, limitatore corrente e color order come stadi finali.
La pagina Cinema espone geometria, frequenza SPI e selezione dei cinque GPIO tramite i dati di PinManager. Mostra separatamente stato link, CRC, frame ID, FPS e timestamp dell'ultima ricezione per camera.
La procedura guidata esegue: verifica delle due mailbox, snapshot sinistro, quadrilatero sinistro, snapshot destro, quadrilatero destro, conteggi/orientamento strip, stage/commit, test LED progressivo e completamento.
I JPEG arrivano in messaggi SNAPSHOT_CHUNK all'interno degli slot SPI. WLED li scrive progressivamente in un file temporaneo LittleFS con dimensione e CRC finale verificati; non conserva il JPEG completo in RAM.

Affidabilità

Frame perso: conserva l'ultimo frame per 150 ms, poi dissolve a nero solo il lato mancante in 250 ms.
Camera lenta: usa l'ultimo frame fresco disponibile, segnala lo skew e non blocca l'altra camera.
Header SPI o CRC pacchetto errato: scarta l'intero slot, incrementa il contatore diagnostico e continua dalla transazione successiva.
Slave non pronto: header vuoto o flag BUSY; il master applica backoff limitato senza bloccare il loop WLED.
Riavvio camera: boot ID cambiato, frame invalidati, nuovo HELLO e verifica della generazione configurazione.
Stallo MISO o bus: dopo una soglia di errori, abbassare opzionalmente la frequenza SPI e consentire riavvio manuale del link dalla UI. Un CS difettoso non deve impedire il polling dell'altra camera.
Logging Error, Warning, Info e Debug deve essere rate-limited e non includere JPEG o frame RGB completi.

Milestone

1. Protocollo raw e codec slot SPI con test CRC, lunghezze, padding, slot vuoti e corruzione.
2. CinemaSpiMaster WLED con configurazione pin disabilitata per default, riserva atomica e polling di due CS.
3. Firmware AI Thinker: SPI slave mailbox, RGB565, JPEG, LittleFS e benchmark stabile a 10/20/30 FPS.
4. Frame store e sincronizzazione: perdita camera, boot ID, frame fuori ordine e timeout.
5. Geometria: omografia, campionamento e test delle quattro origini/direzioni.
6. Correzione colore con test deterministici.
7. UI completa, wizard, snapshot proxy e commit transazionale.
8. Qualifica end-to-end: 300/600 LED, tre profili FPS, cavo scollegato, CRC errato, clock degradato, brownout e test perimetrale.

Verifica

Per modifiche web: `npm run build`, poi `npm test`.
Per WLED: `pio run -e esp32dev` dopo il build web.
Per le camere: build PlatformIO `esp32cam`, test host della libreria protocollo e prove hardware con analizzatore logico.
Non modificare manualmente gli header generati `wled00/html_*.h` e `wled00/js_*.h`.

