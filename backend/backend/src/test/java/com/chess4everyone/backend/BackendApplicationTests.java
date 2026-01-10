package com.chess4everyone.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import com.chess4everyone.backend.config.TestMailConfig;

@SpringBootTest
@Import(TestMailConfig.class)
class BackendApplicationTests {

	@Test
	void contextLoads() {
	}

}
