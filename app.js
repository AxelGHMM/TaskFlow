// app.js

document.addEventListener('DOMContentLoaded', () => {
  
  const contenedorTareas = document.getElementById('task-list-container');
  const loadingMsg = document.getElementById('loading-msg');
  const fabButton = document.querySelector('.fab');
  // const geoButton = document.querySelector('.profile-icon'); // No lo usamos para el alert

  const tareasCollection = db.collection('tareas');
  const TAREAS_LOCAL_KEY = 'misTareasLocal';

  // --- 2. Función "dibujar" (MODIFICADA para ubicación y swipe) ---
  function renderizarTareas(tareas = []) {
    contenedorTareas.innerHTML = ''; 
    if (loadingMsg) loadingMsg.remove();

    // --- NUEVO: Filtramos las tareas marcadas como borradas ---
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
        // ... (tu lógica de 'change' se queda igual) ...
      });
      
      const textContainer = document.createElement('div');
      textContainer.className = 'task-text-container';
      const label = document.createElement('label');
      label.setAttribute('for', `task-${tarea.id}`);
      label.textContent = tarea.titulo;
      textContainer.appendChild(label);

      if (tarea.ubicacion) {
        const locationSpan = document.createElement('span');
        locationSpan.className = 'task-location';
        locationSpan.textContent = tarea.ubicacion;
        textContainer.appendChild(locationSpan);
      }
      
      tareaDiv.appendChild(checkbox);
      tareaDiv.appendChild(textContainer);
      contenedorTareas.appendChild(tareaDiv);

      // --- INICIO DE LÓGICA DE SWIPE (NUEVO) ---
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
            eliminarTarea(tarea.id); // Llama a la nueva función de borrado
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

  // --- 3. Guardar Tareas (MODIFICADO para ubicación y borrado) ---
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
        ubicacion: locationString, // (Tu lógica de ubicación)
        completada: false,
        sincronizado: false,
        borrado: false // <--- NUEVO: bandera de borrado
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

  // --- NUEVA FUNCIÓN: Marcar Tarea para Borrar ---
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

  // --- 4. Sincronización (MODIFICADA para borrado y ubicación) ---
  function sincronizarConFirestore() {
    const tareasLocales = JSON.parse(localStorage.getItem(TAREAS_LOCAL_KEY)) || [];
    
    // Tareas para AÑADIR (que no estén borradas)
    const tareasParaSincronizar = tareasLocales.filter(t => t.sincronizado === false && !t.borrado);
    
    // --- NUEVO: Tareas para BORRAR ---
    const tareasParaBorrar = tareasLocales.filter(t => t.borrado === true && t.sincronizado === false && !t.id.startsWith('local-'));

    if (tareasParaSincronizar.length === 0 && tareasParaBorrar.length === 0) {
      console.log('Todo está sincronizado.');
      return;
    }
    
    console.log(`Sincronizando ${tareasParaSincronizar.length} tareas y borrando ${tareasParaBorrar.length}...`);
    
    const batch = db.batch();

    // Lote de tareas para AÑADIR
    tareasParaSincronizar.forEach(tarea => {
      const docRef = tareasCollection.doc();
      const tareaFirestore = {
        titulo: tarea.titulo,
        ubicacion: tarea.ubicacion || "N/A", // (Tu lógica de ubicación)
        completada: tarea.completada,
        id: docRef.id 
      };
      batch.set(docRef, tareaFirestore);
    });

    // --- NUEVO: Lote de tareas para BORRAR ---
    tareasParaBorrar.forEach(tarea => {
      if (tarea.id && !tarea.id.startsWith('local-')) {
          const docRef = tareasCollection.doc(tarea.id);
          batch.delete(docRef);
      }
    });

    // Envía el paquete a Firebase
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

  // --- 5. Carga Inicial (MODIFICADA) ---
  function cargarTareasDesdeFirestore() {
    console.log('Cargando tareas desde Firestore...');
    tareasCollection.get()
      .then(snapshot => {
        const tareas = [];
        if (snapshot.empty) {
          console.log('No hay tareas en Firestore.');
        }
        
        snapshot.forEach(doc => {
          // --- NUEVO: Añade banderas por defecto ---
          tareas.push({ ...doc.data(), borrado: false, sincronizado: true });
        });
        
        // Compara con las locales antes de sobrescribir
        const tareasLocales = JSON.parse(localStorage.getItem(TAREAS_LOCAL_KEY)) || [];
        const tareasOfflineSinSincronizar = tareasLocales.filter(t => t.sincronizado === false);
        
        // Combina las tareas de Firebase + las locales que aún no se suben
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
  
  // --- Lógica de Geolocalización (Tu código) ---
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

  async function convertirCoordenadasA_Direccion(coords) {
    if (!coords) return "Ubicación desconocida";
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lon}&zoom=18`, {
        headers: {
          'User-Agent': 'TaskFlowApp (axelghmm.github.io)'
        }
      });
      const data = await response.json();
      if (data.display_name) {
        const parts = data.display_name.split(',');
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