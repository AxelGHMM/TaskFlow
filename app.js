// app.js

document.addEventListener('DOMContentLoaded', () => {
  
  const contenedorTareas = document.getElementById('task-list-container');
  const loadingMsg = document.getElementById('loading-msg');
  const fabButton = document.querySelector('.fab');
  // const geoButton = document.querySelector('.profile-icon'); // Ya no lo usamos para el alert

  // --- ¡CAMBIO IMPORTANTE! ---
  // Pega tu API Key de locationiq.com aquí
  const LOCATIONIQ_API_KEY = "PEGA_TU_API_KEY_AQUI"; 
  // -------------------------

  const tareasCollection = db.collection('tareas');
  const TAREAS_LOCAL_KEY = 'misTareasLocal';

  // --- 2. Función "dibujar" (con Ubicación y Swipe) ---
  function renderizarTareas(tareas = []) {
    contenedorTareas.innerHTML = ''; 
    if (loadingMsg) loadingMsg.remove();

    // Filtramos las tareas marcadas como borradas
    const tareasMostrables = tareas.filter(t => !t.borrado);

    if (tareasMostrables.length === 0) {
      contenedorTareas.innerHTML = '<p style="text-align: center;">No hay tareas pendientes.</p>';
      return;
    }

    tareasMostrables.forEach(tarea => {
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
      
      // Contenedor para el texto y la ubicación
      const textContainer = document.createElement('div');
      textContainer.className = 'task-text-container';

      const label = document.createElement('label');
      label.setAttribute('for', `task-${tarea.id}`);
      label.textContent = tarea.titulo;
      textContainer.appendChild(label);

      // Muestra la ubicación si existe
      if (tarea.ubicacion) {
        const locationSpan = document.createElement('span');
        locationSpan.className = 'task-location';
        locationSpan.textContent = tarea.ubicacion;
        textContainer.appendChild(locationSpan);
      }
      
      tareaDiv.appendChild(checkbox);
      tareaDiv.appendChild(textContainer);
      contenedorTareas.appendChild(tareaDiv);

      // --- Lógica de SWIPE ---
      let startX = 0;
      let deltaX = 0;
      tareaDiv.addEventListener('touchstart', (e) => {
        startX = e.touches[0].pageX;
        tareaDiv.style.transition = 'none'; 
      });
      tareaDiv.addEventListener('touchmove', (e) => {
        deltaX = e.touches[0].pageX - startX;
        if (deltaX > 0) { 
          tareaDiv.style.transform = `translateX(${deltaX}px)`;
        }
      });
      tareaDiv.addEventListener('touchend', (e) => {
        tareaDiv.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
        if (deltaX > 100) {
          tareaDiv.classList.add('deleting');
          setTimeout(() => {
            eliminarTarea(tarea.id);
          }, 300);
        } else {
          tareaDiv.style.transform = 'translateX(0px)';
        }
        startX = 0;
        deltaX = 0;
      });
      // --- FIN DE LÓGICA DE SWIPE ---
    });
  }

  // --- 3. Guardar Tareas (con Ubicación Contextual) ---
  fabButton.addEventListener('click', async () => {
    
    const originalFabText = fabButton.innerHTML;
    fabButton.innerHTML = '...';
    fabButton.disabled = true;

    let locationString = "Ubicación no disponible";
    try {
      const coords = await obtenerUbicacionActual();
      locationString = await convertirCoordenadasA_Direccion(coords);
    } catch (error) {
      console.warn('Error de ubicación:', error);
    }

    const titulo = prompt('Escribe el título de la nueva tarea:');
    
    if (titulo && titulo.trim() !== '') {
      
      const nuevaTarea = {
        id: `local-${Date.now()}`, 
        titulo: titulo.trim(),
        ubicacion: locationString,
        completada: false,
        sincronizado: false,
        borrado: false
      };

      const tareasLocales = JSON.parse(localStorage.getItem(TAREAS_LOCAL_KEY)) || [];
      tareasLocales.push(nuevaTarea);
      localStorage.setItem(TAREAS_LOCAL_KEY, JSON.stringify(tareasLocales));
      
      renderizarTareas(tareasLocales);
      sincronizarConFirestore();
      mostrarNotificacionLocal('¡Tarea Agregada!', `La tarea "${titulo}" se guardó.`);
    }
    
    fabButton.innerHTML = originalFabText;
    fabButton.disabled = false;
  });

  // --- Función de Borrado (Swipe) ---
  function eliminarTarea(id) {
    console.log(`Marcando para borrar: ${id}`);
    const tareasLocales = JSON.parse(localStorage.getItem(TAREAS_LOCAL_KEY)) || [];
    
    const nuevasTareasLocales = tareasLocales.map(tarea => {
      if (tarea.id === id) {
        return { ...tarea, borrado: true, sincronizado: false }; 
      }
      return tarea;
    });

    localStorage.setItem(TAREAS_LOCAL_KEY, JSON.stringify(nuevasTareasLocales));
    renderizarTareas(nuevasTareasLocales);
    sincronizarConFirestore();
  }

  // --- 4. Sincronización (con Borrado y Ubicación) ---
  function sincronizarConFirestore() {
    const tareasLocales = JSON.parse(localStorage.getItem(TAREAS_LOCAL_KEY)) || [];
    
    const tareasParaSincronizar = tareasLocales.filter(t => t.sincronizado === false && !t.borrado);
    const tareasParaBorrar = tareasLocales.filter(t => t.borrado === true && t.sincronizado === false && !t.id.startsWith('local-'));

    if (tareasParaSincronizar.length === 0 && tareasParaBorrar.length === 0) {
      console.log('Todo está sincronizado.');
      return;
    }
    
    console.log(`Sincronizando ${tareasParaSincronizar.length} tareas y borrando ${tareasParaBorrar.length}...`);
    
    const batch = db.batch();

    tareasParaSincronizar.forEach(tarea => {
      const docRef = tareasCollection.doc();
      const tareaFirestore = {
        titulo: tarea.titulo,
        ubicacion: tarea.ubicacion || "N/A",
        completada: tarea.completada,
        id: docRef.id 
      };
      batch.set(docRef, tareaFirestore);
    });

    tareasParaBorrar.forEach(tarea => {
      if (tarea.id && !tarea.id.startsWith('local-')) {
          const docRef = tareasCollection.doc(tarea.id);
          batch.delete(docRef);
      }
    });

    batch.commit()
      .then(() => {
        console.log('Sincronización (crear/borrar) exitosa.');
        localStorage.removeItem(TAREAS_LOCAL_KEY);
        cargarTareasDesdeFirestore();
      })
      .catch(error => {
        console.error('Error al sincronizar (crear/borrar):', error);
      });
  }

  // --- 5. Carga Inicial (con Banderas de Borrado/Sincro) ---
  function cargarTareasDesdeFirestore() {
    console.log('Cargando tareas desde Firestore...');
    tareasCollection.get()
      .then(snapshot => {
        const tareas = [];
        if (snapshot.empty) {
          console.log('No hay tareas en Firestore.');
        }
        
        snapshot.forEach(doc => {
          tareas.push({ ...doc.data(), borrado: false, sincronizado: true });
        });
        
        const tareasLocales = JSON.parse(localStorage.getItem(TAREAS_LOCAL_KEY)) || [];
        const tareasOfflineSinSincronizar = tareasLocales.filter(t => t.sincronizado === false);
        
        const tareasCombinadas = [...tareas, ...tareasOfflineSinSincronizar];
        
        localStorage.setItem(TAREAS_LOCAL_KEY, JSON.stringify(tareasCombinadas));
        renderizarTareas(tareasCombinadas);
      })
      .catch(err => {
        console.error('Error cargando desde Firestore. Usando caché local.', err);
        const tareasLocales = JSON.parse(localStorage.getItem(TAREAS_LOCAL_KEY)) || [];
        renderizarTareas(tareasLocales);
      });
  }

  // --- Lógica de Notificaciones (Ejercicio 2) ---
  function solicitarPermisoNotificaciones() {
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
    if (Notification.permission === 'granted') {
      const options = {
        body: cuerpo,
        icon: 'images/icons/icono-192.png' // Asegúrate que esta ruta sea correcta
      };
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(titulo, options)
          .catch(err => {
             console.error('Error al mostrar la notificación:', err);
          });
      });
    } else {
      console.log('No se tiene permiso para mostrar notificaciones.');
    }
  }
  
  // --- Lógica de Geolocalización (Ejercicio 3 - con LocationIQ) ---
  
  // Función 1: Obtiene el GPS
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
            console.warn('No se pudo obtener ubicación:', error.message);
            reject(new Error('No se pudo obtener ubicación.'));
          },
          {
            enableHighAccuracy: false,
            timeout: 5000, 
            maximumAge: 600000 
          }
        );
      } else {
        reject(new Error('Geolocalización no soportada'));
      }
    });
  }

  // Función 2: Convierte Coordenadas (con LocationIQ)
  async function convertirCoordenadasA_Direccion(coords) {
    if (!coords) return "Ubicación desconocida";
    
    if (LOCATIONIQ_API_KEY === "PEGA_TU_API_KEY_AQUI") {
        console.warn('Falta API Key de LocationIQ. Usando ubicación por defecto.');
        return "Cerca de tu ubicación";
    }
    
    try {
      const response = await fetch(`https://us1.locationiq.com/v1/reverse.php?key=${LOCATIONIQ_API_KEY}&lat=${coords.lat}&lon=${coords.lon}&format=json`);
      const data = await response.json();
      
      if (data.display_name) {
        const parts = data.display_name.split(',');
        return parts.length > 1 ? `${parts[0].trim()}, ${parts[1].trim()}` : parts[0].trim();
      }
      return "Cerca de tu ubicación";
    } catch (error) {
      console.error('Error en Reverse Geocoding (LocationIQ):', error);
      return "Ubicación no disponible (sin red)";
    }
  }
  // --- FIN EJERCICIO 3 ---

  // --- Arranque de la App ---
  solicitarPermisoNotificaciones();
  sincronizarConFirestore();
  cargarTareasDesdeFirestore();

});