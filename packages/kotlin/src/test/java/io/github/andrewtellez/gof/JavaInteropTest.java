package io.github.andrewtellez.gof;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * The package is a plain JVM jar, so Java can use it. This test is the proof, and it
 * is written the way a Java caller would actually write it — if something here needs
 * a Kotlin-only feature, the interop is broken and this file will not compile.
 */
class JavaInteropTest {

    @Test
    void registryFromJava() {
        Registry<String, java.util.function.IntFunction<String>> rails = new Registry<>();
        rails.register("stripe", cents -> "stripe:" + cents);
        assertEquals("stripe:500", rails.get("stripe").apply(500));
        assertTrue(rails.contains("stripe"));
    }

    @Test
    void stateMachineFromJava() {
        StateMachine<String, String> order = new StateMachine<>(
            "draft",
            Map.of("draft", Map.of("pay", "paid"), "paid", Map.of())
        );
        assertEquals("paid", order.send("pay"));
        assertFalse(order.can("pay"));
        assertThrows(IllegalStateException.class, () -> order.send("pay"));
    }

    @Test
    void observerAndHistoryFromJava() {
        List<Integer> seen = new ArrayList<>();
        Subject<Integer> subject = new Subject<>();
        subject.subscribe(value -> {
            seen.add(value);
            return kotlin.Unit.INSTANCE;
        });
        subject.emit(7);
        assertEquals(List.of(7), seen);

        History<String> history = new History<>("a");
        history.save("b");
        assertEquals("a", history.undo());
        assertEquals("b", history.redo());
    }

    @Test
    void compositeFromJava() {
        Composite<Double> root = new Composite<>(10.0);
        root.add(new Composite<>(5.0));
        assertEquals(15.0, root.sum(value -> value));
        assertEquals(2, root.getSize());
    }

    @Test
    void commandBusFromJava() {
        List<String> cart = new ArrayList<>();
        CommandBus bus = new CommandBus();
        bus.run(new Command<>(
            () -> cart.add("book"),
            () -> {
                cart.remove("book");
                return kotlin.Unit.INSTANCE;
            }
        ));
        assertEquals(List.of("book"), cart);
        assertTrue(bus.undo());
        assertTrue(cart.isEmpty());
    }
}
