// app.js

document.addEventListener('DOMContentLoaded', () => {
  
  const contenedorTareas = document.getElementById('task-list-container');
  const loadingMsg = document.getElementById('loading-msg');
  const fabButton = document.querySelector('.fab');
  
  // --- EJERCICIO 3 (AÑADIDO) ---
  // 1. Obtenemos el nuevo botón del header
  const geoButton = document.querySelector('.profile-icon'); 
  // --- FIN EJERCICIO 3 ---

  // --- 1. Referencia a la base de datos ---
  // Esta variable 'db' la creamos en el index.html al iniciar Firebase.
  const tareasCollection = db.collection('tareas');
  const TAREAS_LOCAL_KEY = 'misTareasLocal';

  // --- 2. Función para "dibujar" las tareas en el HTML ---
  function renderizarTareas(tareas = []) {
    // ... (Tu código se queda igual) ...
    contenedorTareas.innerHTML = ''; 
    if (loadingMsg) loadingMsg.remove();
    if (tareas.length === 0) {
      contenedorTareas.innerHTML = '<p style="text-align: center;">No hay tareas pendientes.</p>';
      return;
    }
    tareas.forEach(tarea => {
      const tareaDiv = document.createElement('div');
      tareaDiv.className = 'task-item';
      if (tarea.completada) {
        tareaDiv.classList.add('completed');
      }
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = tarea.completada;
      checkbox.id = `task-${tarea.id}`;
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          tareaDiv.classList.add('completed');
        } else {
          tareaDiv.classList.remove('completed');
        }
        // TODO: Añadir lógica de update en Firebase
      });
      const label = document.createElement('label');
      label.setAttribute('for', `task-${tarea.id}`);
      label.textContent = tarea.titulo;
      tareaDiv.appendChild(checkbox);
      tareaDiv.appendChild(label);
      contenedorTareas.appendChild(tareaDiv);
    });
  }

  // --- 3. Guardar Tareas Nuevas (Lógica Offline-First) ---
  fabButton.addEventListener('click', () => {
    const titulo = prompt('Escribe el título de la nueva tarea:');
    
    if (titulo && titulo.trim() !== '') {
      
      const nuevaTarea = {
        id: `local-${Date.now()}`, 
        titulo: titulo.trim(),
        completada: false,
        sincronizado: false 
      };

      const tareasLocales = JSON.parse(localStorage.getItem(TAREAS_LOCAL_KEY)) || [];
      tareasLocales.push(nuevaTarea);
      localStorage.setItem(TAREAS_LOCAL_KEY, JSON.stringify(tareasLocales));
      
      renderizarTareas(tareasLocales);
      
      sincronizarConFirestore();
      
      // --- EJERCICIO 2 (Tu código) ---
      mostrarNotificacionLocal('¡Tarea Agregada!', `La tarea "${titulo}" se guardó.`);
    }
  });

  // --- 4. Sincronización con Firebase (El corazón del Ejercicio 1) ---
  function sincronizarConFirestore() {
    // ... (Tu código se queda igual) ...
    const tareasLocales = JSON.parse(localStorage.getItem(TAREAS_LOCAL_KEY)) || [];
    const tareasParaSincronizar = tareasLocales.filter(t => t.sincronizado === false);
    if (tareasParaSincronizar.length === 0) {
      console.log('Todo está sincronizado.');
      return;
    }
    console.log(`Sincronizando ${tareasParaSincronizar.length} tareas...`);
    const batch = db.batch();
    tareasParaSincronizar.forEach(tarea => {
      const docRef = tareasCollection.doc();
      const tareaFirestore = {
        titulo: tarea.titulo,
        completada: tarea.completada,
        id: docRef.id 
      };
      batch.set(docRef, tareaFirestore);
    });
    batch.commit()
      .then(() => {
        console.log('Sincronización exitosa.');
        localStorage.removeItem(TAREAS_LOCAL_KEY);
        cargarTareasDesdeFirestore();
      })
      .catch(error => {
        console.error('Error al sincronizar:', error);
      });
  }

  // --- 5. Carga Inicial de Tareas ---
  function cargarTareasDesdeFirestore() {
    // ... (Tu código se queda igual) ...
    console.log('Cargando tareas desde Firestore...');
    tareasCollection.get()
      .then(snapshot => {
        if (snapshot.empty) {
          console.log('No hay tareas en Firestore.');
          renderizarTareas([]);
          return;
        }
        const tareas = [];
        snapshot.forEach(doc => {
          tareas.push(doc.data());
        });
        localStorage.setItem(TAREAS_LOCAL_KEY, JSON.stringify(tareas));
        renderizarTareas(tareas);
      })
      .catch(err => {
        console.error('Error cargando desde Firestore. Usando caché local.', err);
        const tareasLocales = JSON.parse(localStorage.getItem(TAREAS_LOCAL_KEY)) || [];
        renderizarTareas(tareasLocales);
      });
  }

  // --- INICIO EJERCICIO 2: Lógica de Notificaciones (Tu código) ---
  function solicitarPermisoNotificaciones() {
    // ... (Tu código se queda igual) ...
    if ('Notification' in window) {
      console.log('El navegador soporta notificaciones.');
      if (Notification.permission === 'default') {
        console.log('Solicitando permiso para notificaciones...');
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            console.log('¡Permiso concedido!');
            mostrarNotificacionLocal('¡Bienvenido a TaskFlow!', 'Las notificaciones están activadas.');
          } else {
            console.log('Permiso denegado.');
          }
        });
      } else {
        console.log('El permiso ya está en estado: ' + Notification.permission);
      }
    } else {
      console.log('Este navegador no soporta notificaciones.');
    }
  }

  function mostrarNotificacionLocal(titulo, cuerpo) {
    // ... (Tu código se queda igual) ...
    if (Notification.permission === 'granted') {
      const options = {
        body: cuerpo,
        icon: 'images/icono-192.png' // Ruta a tu ícono
      };
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(titulo, options);
      });
    } else {
      console.log('No se tiene permiso para mostrar notificaciones.');
    }
  }
  // --- FIN EJERCICIO 2 ---


  // --- INICIO EJERCICIO 3: Geolocalización (NUEVO) ---
  function obtenerGeolocalizacion() {
    // 1. Revisa si el navegador soporta Geolocalización
    if ('geolocation' in navigator) {
      console.log('Obteniendo ubicación...');
      
      // 2. Pide la ubicación
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // 3. Éxito: Muestra los datos en un alert
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          
          console.log('Ubicación obtenida:', lat, lon);
          alert(`Estás aquí:\nLatitud: ${lat}\nLongitud: ${lon}`);
          
          // Opcional: Guarda la ubicación en Firestore
          db.collection('ubicaciones').add({
            lat: lat,
            lon: lon,
            timestamp: new Date()
          })
          .then(() => console.log('Ubicación guardada en Firestore.'))
          .catch(err => console.error('Error al guardar ubicación:', err));
          
        },
        (error) => {
          // 4. Manejo de errores
          console.error('Error al obtener la ubicación:', error.message);
          alert('Error: No se pudo obtener tu ubicación.');
        }
      );
      
    } else {
      console.log('Este navegador no soporta Geolocalización.');
      alert('Tu navegador no soporta geolocalización.');
    }
  }

  // 2. Asigna el evento al botón que está en el HTML
  geoButton.addEventListener('click', obtenerGeolocalizacion);
  
  // --- FIN EJERCICIO 3 ---

  
  // --- Arranque de la App (MODIFICADO) ---
  
  // 1. Pide permiso para notificaciones (Ejercicio 2)
  solicitarPermisoNotificaciones();
  
  // 2. Intenta sincronizar por si quedaron tareas pendientes
  sincronizarConFirestore();
  
  // 3. Carga la lista de tareas
  cargarTareasDesdeFirestore();

});