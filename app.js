// app.js

document.addEventListener('DOMContentLoaded', () => {
  
  const contenedorTareas = document.getElementById('task-list-container');
  const loadingMsg = document.getElementById('loading-msg');
  const fabButton = document.querySelector('.fab');

  // --- 1. Referencia a la base de datos ---
  // Esta variable 'db' la creamos en el index.html al iniciar Firebase.
  const tareasCollection = db.collection('tareas');
  const TAREAS_LOCAL_KEY = 'misTareasLocal';

  // --- 2. Función para "dibujar" las tareas en el HTML ---
  function renderizarTareas(tareas = []) {
    // Limpia el contenedor (y el mensaje de "cargando")
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
      
      // (Opcional) Lógica para marcar como completada
      checkbox.addEventListener('change', () => {
        // Aquí podríamos actualizar el estado en Firebase
        // Por ahora, solo actualiza visualmente
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
      
      // Crea la nueva tarea
      const nuevaTarea = {
        // Usamos un ID temporal para el modo offline
        id: `local-${Date.now()}`, 
        titulo: titulo.trim(),
        completada: false,
        // Añadimos una marca para saber que necesita sincronizarse
        sincronizado: false 
      };

      // 1. Guarda localmente de inmediato
      const tareasLocales = JSON.parse(localStorage.getItem(TAREAS_LOCAL_KEY)) || [];
      tareasLocales.push(nuevaTarea);
      localStorage.setItem(TAREAS_LOCAL_KEY, JSON.stringify(tareasLocales));
      
      // 2. "Dibuja" la lista local
      renderizarTareas(tareasLocales);
      
      // 3. Intenta sincronizar con Firebase
      sincronizarConFirestore();
      
      // --- EJERCICIO 2 (AÑADIDO) ---
      // Mostramos una notificación después de agregar la tarea
      mostrarNotificacionLocal('¡Tarea Agregada!', `La tarea "${titulo}" se guardó.`);
      // --- FIN EJERCICIO 2 ---
    }
  });

  // --- 4. Sincronización con Firebase (El corazón del Ejercicio 1) ---
  function sincronizarConFirestore() {
    const tareasLocales = JSON.parse(localStorage.getItem(TAREAS_LOCAL_KEY)) || [];
    
    // Busca tareas que no estén sincronizadas
    const tareasParaSincronizar = tareasLocales.filter(t => t.sincronizado === false);

    if (tareasParaSincronizar.length === 0) {
      console.log('Todo está sincronizado.');
      return;
    }
    
    console.log(`Sincronizando ${tareasParaSincronizar.length} tareas...`);
    
    // Usamos un "batch" para enviar todas las tareas en un solo paquete
    const batch = db.batch();

    tareasParaSincronizar.forEach(tarea => {
      // Creamos un ID permanente en Firestore
      const docRef = tareasCollection.doc();
      // Preparamos la tarea para guardarla (quitando la marca 'sincronizado')
      const tareaFirestore = {
        titulo: tarea.titulo,
        completada: tarea.completada,
        // Usamos el ID de firestore como el ID principal
        id: docRef.id 
      };
      batch.set(docRef, tareaFirestore);
    });

    // Envía el paquete a Firebase
    batch.commit()
      .then(() => {
        console.log('Sincronización exitosa.');
        // Si todo salió bien, borramos las tareas locales
        // y descargamos la lista fresca de Firebase.
        localStorage.removeItem(TAREAS_LOCAL_KEY);
        cargarTareasDesdeFirestore();
      })
      .catch(error => {
        console.error('Error al sincronizar:', error);
        // Si falla (ej. sin internet), no hacemos nada.
        // Las tareas siguen guardadas localmente.
        // Lo volveremos a intentar en la próxima carga.
      });
  }

  // --- 5. Carga Inicial de Tareas ---
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
        
        // Guarda la lista fresca en localStorage (como caché)
        localStorage.setItem(TAREAS_LOCAL_KEY, JSON.stringify(tareas));
        
        // Dibuja las tareas
        renderizarTareas(tareas);
      })
      .catch(err => {
        console.error('Error cargando desde Firestore. Usando caché local.', err);
        // Si falla (sin internet), carga las del caché local
        const tareasLocales = JSON.parse(localStorage.getItem(TAREAS_LOCAL_KEY)) || [];
        renderizarTareas(tareasLocales);
      });
  }

  // --- INICIO EJERCICIO 2: Lógica de Notificaciones (NUEVO) ---

  // Pide permiso al usuario en cuanto carga la app
  function solicitarPermisoNotificaciones() {
    // Revisa si el navegador soporta notificaciones
    if ('Notification' in window) {
      console.log('El navegador soporta notificaciones.');
      // 'default', 'granted', 'denied'
      if (Notification.permission === 'default') {
        console.log('Solicitando permiso para notificaciones...');
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            console.log('¡Permiso concedido!');
            // Muestra una notificación de bienvenida
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

  // Muestra la notificación
  function mostrarNotificacionLocal(titulo, cuerpo) {
    // Revisa si el permiso fue concedido
    if (Notification.permission === 'granted') {
      
      // Opciones de la notificación
      const options = {
        body: cuerpo,
        icon: 'images/icono-192.png' // Ruta a tu ícono
      };

      // Muestra la notificación
      // Usamos el 'registration' del Service Worker para mostrarla
      // Esto es más estándar para PWAs
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(titulo, options);
      });

    } else {
      console.log('No se tiene permiso para mostrar notificaciones.');
    }
  }
  
  // --- FIN EJERCICIO 2 ---
  
  // --- Arranque de la App (MODIFICADO) ---
  
  // 1. Pide permiso para notificaciones (Ejercicio 2)
  solicitarPermisoNotificaciones();
  
  // 2. Intenta sincronizar por si quedaron tareas pendientes
  sincronizarConFirestore();
  
  // 3. Carga la lista de tareas
  cargarTareasDesdeFirestore();

});