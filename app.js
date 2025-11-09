// app.js

document.addEventListener('DOMContentLoaded', () => {
  
  const contenedorTareas = document.getElementById('task-list-container');
  const loadingMsg = document.getElementById('loading-msg');
  const fabButton = document.querySelector('.fab');
  const geoButton = document.querySelector('.profile-icon'); 
  const tareasCollection = db.collection('tareas');
  const TAREAS_LOCAL_KEY = 'misTareasLocal';

  // --- 2. Función "dibujar" (MODIFICADA para swipe y borrado) ---
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
      
      // ... (Tu código de checkbox y label) ...
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

      // --- INICIO DE LÓGICA DE SWIPE (NUEVO) ---
      let startX = 0;
      let deltaX = 0;

      // Eventos Táctiles (para móviles)
      tareaDiv.addEventListener('touchstart', (e) => {
        startX = e.touches[0].pageX;
        // Quita la transición suave para que siga al dedo
        tareaDiv.style.transition = 'none'; 
      });

      tareaDiv.addEventListener('touchmove', (e) => {
        deltaX = e.touches[0].pageX - startX;
        // Solo permite deslizar a la derecha
        if (deltaX > 0) { 
          tareaDiv.style.transform = `translateX(${deltaX}px)`;
        }
      });

      tareaDiv.addEventListener('touchend', (e) => {
        // Vuelve a poner la transición suave
        tareaDiv.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
        
        // Decide si se borra o se regresa
        // (Si se deslizó más de 100px)
        if (deltaX > 100) {
          // 1. Añade la clase CSS para la animación de salida
          tareaDiv.classList.add('deleting');
          
          // 2. Espera a que termine la animación (300ms) y borra
          setTimeout(() => {
            eliminarTarea(tarea.id);
          }, 300);
          
        } else {
          // 3. Si no fue suficiente, regresa a su posición
          tareaDiv.style.transform = 'translateX(0px)';
        }
        
        // Resetea las variables
        startX = 0;
        deltaX = 0;
      });
      // --- FIN DE LÓGICA DE SWIPE ---
    });
  }

  // --- 3. Guardar Tareas (MODIFICADO) ---
  fabButton.addEventListener('click', () => {
    const titulo = prompt('Escribe el título de la nueva tarea:');
    
    if (titulo && titulo.trim() !== '') {
      
      const nuevaTarea = {
        id: `local-${Date.now()}`, 
        titulo: titulo.trim(),
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
  });

  // --- NUEVA FUNCIÓN: Marcar Tarea para Borrar ---
  function eliminarTarea(id) {
    console.log(`Marcando para borrar: ${id}`);
    const tareasLocales = JSON.parse(localStorage.getItem(TAREAS_LOCAL_KEY)) || [];
    
    // Busca la tarea y la marca como borrada
    const nuevasTareasLocales = tareasLocales.map(tarea => {
      if (tarea.id === id) {
        // Marca para borrar Y para sincronizar el borrado
        return { ...tarea, borrado: true, sincronizado: false }; 
      }
      return tarea;
    });

    localStorage.setItem(TAREAS_LOCAL_KEY, JSON.stringify(nuevasTareasLocales));
    renderizarTareas(nuevasTareasLocales); // Vuelve a dibujar (la oculta)
    sincronizarConFirestore(); // Sincroniza el borrado
  }

  // --- 4. Sincronización (MODIFICADA para borrado) ---
  function sincronizarConFirestore() {
    const tareasLocales = JSON.parse(localStorage.getItem(TAREAS_LOCAL_KEY)) || [];
    
    // Tareas para AÑADIR (que no estén borradas)
    const tareasParaSincronizar = tareasLocales.filter(t => t.sincronizado === false && !t.borrado);
    
    // --- NUEVO: Tareas para BORRAR (que ya existan en Firebase) ---
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
        completada: tarea.completada,
        id: docRef.id 
      };
      batch.set(docRef, tareaFirestore);
    });

    // --- NUEVO: Lote de tareas para BORRAR ---
    tareasParaBorrar.forEach(tarea => {
      const docRef = tareasCollection.doc(tarea.id);
      batch.delete(docRef);
    });

    // Envía el paquete a Firebase
    batch.commit()
      .then(() => {
        console.log('Sincronización (crear/borrar) exitosa.');
        // Si todo salió bien, descargamos la lista fresca.
        // Esto elimina permanentemente las tareas marcadas como 'borrado'
        // Y actualiza los IDs locales a los de Firebase
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
          // --- NUEVO: Añade la bandera 'borrado' y 'sincronizado' ---
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

  // --- Lógica de Notificaciones (Tu código) ---
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
        icon: 'images/icono-192.png' // Ruta a tu ícono
      };
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(titulo, options);
      });
    } else {
      console.log('No se tiene permiso para mostrar notificaciones.');
    }
  }
  
  // --- Lógica de Geolocalización (Tu código) ---
  function obtenerGeolocalizacion() {
    if ('geolocation' in navigator) {
      console.log('Obteniendo ubicación...');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          console.log('Ubicación obtenida:', lat, lon);
          alert(`Estás aquí:\nLatitud: ${lat}\nLongitud: ${lon}`);
          db.collection('ubicaciones').add({
            lat: lat,
            lon: lon,
            timestamp: new Date()
          })
          .then(() => console.log('Ubicación guardada en Firestore.'))
          .catch(err => console.error('Error al guardar ubicación:', err));
        },
        (error) => {
          console.error('Error al obtener la ubicación:', error.message);
          alert('Error: No se pudo obtener tu ubicación.');
        }
      );
    } else {
      console.log('Este navegador no soporta Geolocalización.');
      alert('Tu navegador no soporta geolocalización.');
    }
  }
  geoButton.addEventListener('click', obtenerGeolocalizacion);

  
  // --- Arranque de la App (Tu código) ---
  solicitarPermisoNotificaciones();
  sincronizarConFirestore();
  cargarTareasDesdeFirestore();

});