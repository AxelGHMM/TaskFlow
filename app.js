// app.js

document.addEventListener('DOMContentLoaded', () => {
  
  const contenedorTareas = document.getElementById('task-list-container');
  const loadingMsg = document.getElementById('loading-msg');
  const fabButton = document.querySelector('.fab');
  // const geoButton = document.querySelector('.profile-icon'); // <-- Ya no lo usamos para el alert

  // --- 1. Referencia a la base de datos ---
  const tareasCollection = db.collection('tareas');
  const TAREAS_LOCAL_KEY = 'misTareasLocal';

  // --- 2. Función para "dibujar" las tareas (MODIFICADA) ---
  function renderizarTareas(tareas = []) {
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
        // ... (tu lógica de 'change' se queda igual) ...
      });
      
      // --- NUEVO: Contenedor para el texto y la ubicación ---
      const textContainer = document.createElement('div');
      textContainer.className = 'task-text-container';

      const label = document.createElement('label');
      label.setAttribute('for', `task-${tarea.id}`);
      label.textContent = tarea.titulo;
      textContainer.appendChild(label);

      // --- NUEVO: Muestra la ubicación si existe ---
      if (tarea.ubicacion) {
        const locationSpan = document.createElement('span');
        locationSpan.className = 'task-location';
        locationSpan.textContent = tarea.ubicacion;
        textContainer.appendChild(locationSpan);
      }
      
      tareaDiv.appendChild(checkbox);
      tareaDiv.appendChild(textContainer); // Añade el contenedor, no solo el label
      contenedorTareas.appendChild(tareaDiv);
    });
  }

  // --- 3. Guardar Tareas (MODIFICADO para obtener ubicación) ---
  fabButton.addEventListener('click', async () => { // <-- Convertido a 'async'
    
    // Mostramos un estado de carga en el botón
    const originalFabText = fabButton.innerHTML;
    fabButton.innerHTML = '...';
    fabButton.disabled = true;

    let locationString = "Ubicación no disponible";
    try {
      // 1. Obtiene el GPS
      const coords = await obtenerUbicacionActual(); // Nueva función
      // 2. Convierte GPS a dirección
      locationString = await convertirCoordenadasA_Direccion(coords); // Nueva función
    } catch (error) {
      console.warn('Error de ubicación:', error);
      // Si la ubicación falla, no detenemos la app, solo usamos el string por defecto.
    }

    // 3. Muestra el prompt para el título
    const titulo = prompt('Escribe el título de la nueva tarea:');
    
    if (titulo && titulo.trim() !== '') {
      
      const nuevaTarea = {
        id: `local-${Date.now()}`, 
        titulo: titulo.trim(),
        ubicacion: locationString, // <-- ¡NUEVO!
        completada: false,
        sincronizado: false 
      };

      const tareasLocales = JSON.parse(localStorage.getItem(TAREAS_LOCAL_KEY)) || [];
      tareasLocales.push(nuevaTarea);
      localStorage.setItem(TAREAS_LOCAL_KEY, JSON.stringify(tareasLocales));
      
      renderizarTareas(tareasLocales);
      sincronizarConFirestore();
      mostrarNotificacionLocal('¡Tarea Agregada!', `La tarea "${titulo}" se guardó.`);
    }
    
    // Restaura el botón
    fabButton.innerHTML = originalFabText;
    fabButton.disabled = false;
  });

  // --- 4. Sincronización (MODIFICADO para guardar ubicación) ---
  function sincronizarConFirestore() {
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
        ubicacion: tarea.ubicacion || "N/A", // <-- ¡NUEVO!
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

  // --- 5. Carga Inicial (Tu código) ---
  function cargarTareasDesdeFirestore() {
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

  // --- Lógica de Notificaciones (Tu código) ---
  function solicitarPermisoNotificaciones() {
    // ... (Tu código se queda igual) ...
  }
  function mostrarNotificacionLocal(titulo, cuerpo) {
    // ... (Tu código se queda igual) ...
  }
  
  // --- INICIO EJERCICIO 3: NUEVAS FUNCIONES DE UBICACIÓN ---
  
  // Función 1: Obtiene el GPS (devuelve una Promesa)
  function obtenerUbicacionActual() {
    return new Promise((resolve, reject) => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lon: position.coords.longitude
            });
          },
          (error) => {
            // Si el usuario niega el permiso, etc.
            console.warn('No se pudo obtener ubicación:', error.message);
            reject(new Error('No se pudo obtener ubicación.'));
          },
          // Opciones para que sea más rápido
          {
            enableHighAccuracy: false,
            timeout: 5000, // 5 segundos de tiempo límite
            maximumAge: 600000 // 10 minutos de caché
          }
        );
      } else {
        reject(new Error('Geolocalización no soportada'));
      }
    });
  }

  // Función 2: Convierte Coordenadas a Dirección (Reverse Geocoding)
  async function convertirCoordenadasA_Direccion(coords) {
    if (!coords) return "Ubicación desconocida";
    try {
      // Usamos la API gratuita de OpenStreetMap (Nominatim)
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lon}&zoom=18`, {
        headers: {
          'User-Agent': 'TaskFlowApp (axelghmm.github.io)' // Política de Nominatim
        }
      });
      const data = await response.json();
      
      // Extrae una dirección simple
      if (data.display_name) {
        const parts = data.display_name.split(',');
        // Devuelve los primeros dos segmentos (ej. "Calle Falsa 123, Colonia Centro")
        return parts.length > 1 ? `${parts[0].trim()}, ${parts[1].trim()}` : parts[0].trim();
      }
      return "Cerca de tu ubicación";
    } catch (error) {
      console.error('Error en Reverse Geocoding:', error);
      return "Ubicación no disponible (sin red)";
    }
  }

  // --- FIN EJERCICIO 3 ---

  // --- Arranque de la App (Tu código) ---
  solicitarPermisoNotificaciones();
  sincronizarConFirestore();
  cargarTareasDesdeFirestore();

});